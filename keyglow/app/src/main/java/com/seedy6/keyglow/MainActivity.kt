package com.seedy6.keyglow

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.InputStream

/**
 * Keyglow is a web app (assets/web) in a full-screen WebView.
 *
 * The page is served from https://appassets.androidplatform.net/ so it counts as a secure origin,
 * which is what lets it use the microphone (getUserMedia) and fetch its own files.
 * This activity adds what a plain WebView lacks: the microphone permission, the file picker for
 * importing MP3s, USB/Bluetooth MIDI keyboards, files shared from other apps, and the back button.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())
    private var pendingPermission: PermissionRequest? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var midi: MidiBridge? = null
    private var pageReady = false
    private var pendingShared: Uri? = null

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION") // databaseEnabled
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        volumeControlStream = AudioManager.STREAM_MUSIC
        WebView.setWebContentsDebuggingEnabled(true)

        web = WebView(this).apply {
            setBackgroundColor(Color.rgb(9, 10, 20))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.textZoom = 100
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            addJavascriptInterface(NativeApi(), "KeyglowAndroid")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    serve(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    if (url.host == HOST) return false
                    // Outside links (licences, the download page) open in the browser.
                    try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (e: Exception) {}
                    return true
                }

                override fun onPageFinished(view: WebView, url: String) {
                    pageReady = true
                    pendingShared?.let { pendingShared = null; deliverShared(it) }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    main.post { handlePermission(request) }
                }

                override fun onShowFileChooser(
                    view: WebView,
                    callback: ValueCallback<Array<Uri>>,
                    params: FileChooserParams
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val types = params.acceptTypes.filter { it.isNotBlank() }
                    val pick = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        if (types.isNotEmpty()) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypesFor(types))
                    }
                    return try {
                        startActivityForResult(Intent.createChooser(pick, "Choose a song"), REQ_FILE)
                        true
                    } catch (e: Exception) {
                        fileCallback = null
                        false
                    }
                }

                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    android.util.Log.d("Keyglow", "${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                    return true
                }
            }
        }
        setContentView(web)
        goImmersive()
        midi = MidiBridge(this) { status, d1, d2 ->
            main.post {
                if (pageReady) web.evaluateJavascript("window.__kgMidi&&window.__kgMidi($status,$d1,$d2)", null)
            }
        }.also { it.start() }
        midi?.onDevicesChanged = {
            main.post { if (pageReady) web.evaluateJavascript("window.__kgMidiDevices&&window.__kgMidiDevices()", null) }
        }

        pendingShared = sharedUri(intent)
        web.loadUrl("https://$HOST/assets/web/index.html")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        sharedUri(intent)?.let { if (pageReady) deliverShared(it) else pendingShared = it }
    }

    private fun sharedUri(intent: Intent?): Uri? {
        intent ?: return null
        return when (intent.action) {
            Intent.ACTION_VIEW -> intent.data
            Intent.ACTION_SEND -> streamExtra(intent)
            else -> null
        }
    }

    @Suppress("DEPRECATION")
    private fun streamExtra(intent: Intent): Uri? = intent.getParcelableExtra(Intent.EXTRA_STREAM)

    /** Copies a file shared from another app into the cache and tells the page where to fetch it. */
    private fun deliverShared(uri: Uri) {
        Thread {
            try {
                val name = displayName(uri) ?: "song.mp3"
                val dir = File(cacheDir, "shared").apply { mkdirs() }
                dir.listFiles()?.forEach { it.delete() }
                val safe = name.replace(Regex("[^A-Za-z0-9._ -]"), "_")
                val out = File(dir, safe)
                contentResolver.openInputStream(uri)?.use { input -> out.outputStream().use { input.copyTo(it) } }
                val json = JSONObject().put("url", "https://$HOST/shared/" + Uri.encode(safe)).put("name", name)
                main.post { web.evaluateJavascript("window.__kgSharedFile&&window.__kgSharedFile($json)", null) }
            } catch (e: Exception) {
                android.util.Log.w("Keyglow", "Could not open shared file", e)
            }
        }.start()
    }

    private fun displayName(uri: Uri): String? = try {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        } ?: uri.lastPathSegment
    } catch (e: Exception) {
        uri.lastPathSegment
    }

    private fun mimeTypesFor(accept: List<String>): Array<String> {
        val out = linkedSetOf<String>()
        for (a in accept.flatMap { it.split(',') }.map { it.trim().lowercase() }) {
            when {
                a.contains('/') -> out += a
                a == ".mid" || a == ".midi" -> { out += "audio/midi"; out += "audio/x-midi"; out += "application/x-midi" }
                a == ".mp3" -> out += "audio/mpeg"
                a.startsWith(".") -> out += "audio/*"
            }
        }
        if (out.isEmpty()) out += "*/*"
        return out.toTypedArray()
    }

    // ---- Microphone ---------------------------------------------------------------------------

    private fun handlePermission(request: PermissionRequest) {
        val wantsAudio = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
        if (!wantsAudio) {
            request.deny()
            return
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            pendingPermission = request
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQ_MIC)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (requestCode != REQ_MIC) return
        val req = pendingPermission ?: return
        pendingPermission = null
        if (results.isNotEmpty() && results[0] == PackageManager.PERMISSION_GRANTED) {
            req.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
        } else {
            req.deny()
        }
    }

    @Deprecated("Activity result API needs AndroidX")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_FILE) return
        val cb = fileCallback ?: return
        fileCallback = null
        val uri = data?.data
        cb.onReceiveValue(if (resultCode == RESULT_OK && uri != null) arrayOf(uri) else null)
    }

    // ---- Serving the app's files ---------------------------------------------------------------

    private fun serve(url: Uri): WebResourceResponse? {
        if (url.host != HOST) return null
        val path = url.path ?: return null
        return try {
            val stream: InputStream = when {
                path.startsWith("/assets/") -> assets.open(path.removePrefix("/assets/"))
                path.startsWith("/shared/") -> {
                    val f = File(File(cacheDir, "shared"), Uri.decode(path.removePrefix("/shared/")))
                    if (!f.canonicalPath.startsWith(File(cacheDir, "shared").canonicalPath)) return notFound()
                    FileInputStream(f)
                }
                else -> return notFound()
            }
            WebResourceResponse(mimeFor(path), null, stream).apply {
                responseHeaders = mapOf(
                    "Access-Control-Allow-Origin" to "*",
                    "Cache-Control" to "no-cache"
                )
            }
        } catch (e: Exception) {
            notFound()
        }
    }

    private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), "".byteInputStream())

    private fun mimeFor(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "webp" -> "image/webp"
        "jpg", "jpeg" -> "image/jpeg"
        "woff2" -> "font/woff2"
        "mp3" -> "audio/mpeg"
        "wav" -> "audio/wav"
        "ogg" -> "audio/ogg"
        "m4a" -> "audio/mp4"
        "mid", "midi" -> "audio/midi"
        "bin" -> "application/octet-stream"
        else -> "application/octet-stream"
    }

    // ---- Window and lifecycle ------------------------------------------------------------------

    @Suppress("DEPRECATION")
    private fun goImmersive() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        if (Build.VERSION.SDK_INT >= 28) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) goImmersive()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        web.resumeTimers()
        if (pageReady) web.evaluateJavascript("window.__kgResume&&window.__kgResume()", null)
    }

    override fun onPause() {
        if (pageReady) web.evaluateJavascript("window.__kgPause&&window.__kgPause()", null)
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        midi?.stop()
        web.destroy()
        super.onDestroy()
    }

    @Deprecated("Back is handled by the page first")
    override fun onBackPressed() {
        web.evaluateJavascript("window.__kgBack?window.__kgBack():false") { handled ->
            if (handled != "true") {
                @Suppress("DEPRECATION")
                super.onBackPressed()
            }
        }
    }

    /** Called from the page as window.KeyglowAndroid. */
    inner class NativeApi {
        @JavascriptInterface
        fun midiDevices(): String = midi?.devicesJson() ?: "[]"

        @JavascriptInterface
        fun hasMidi(): Boolean = midi?.supported == true

        @JavascriptInterface
        fun version(): String = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: ""
        } catch (e: Exception) { "" }

        @JavascriptInterface
        fun openUrl(url: String) {
            main.post { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (e: Exception) {} }
        }

        @JavascriptInterface
        fun exitApp() {
            main.post { finish() }
        }
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        private const val REQ_MIC = 7
        private const val REQ_FILE = 8
    }
}
