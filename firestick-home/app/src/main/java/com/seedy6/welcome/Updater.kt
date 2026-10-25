package com.seedy6.welcome

import android.content.Context
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.zip.ZipInputStream

/**
 * Keeps Welcome Home up to date from the GitHub release that CI publishes.
 *
 * Each build stamps two hashes into assets/build.json: "native" for the Kotlin side and "web"
 * for the page. When only the page has changed, the new page is downloaded and used straight
 * away, with no reinstall. When the native side has changed, the page can't be swapped on its
 * own (it may call bridge methods this APK lacks), so the user is offered an APK update instead.
 */
class Updater(private val activity: MainActivity) {
    private val exec = Executors.newSingleThreadExecutor()
    private val prefs = activity.getSharedPreferences("update", Context.MODE_PRIVATE)
    private val webDir = File(activity.filesDir, "web")
    private val baked: JSONObject = try {
        JSONObject(activity.assets.open("build.json").bufferedReader().use { it.readText() })
    } catch (e: Exception) {
        JSONObject().put("native", "dev").put("web", "dev")
    }

    /** The page to load: a downloaded update built for this exact APK, else the bundled page. */
    fun pageUrl(): String {
        val meta = File(webDir, "build.json")
        if (meta.exists()) {
            val native = try { JSONObject(meta.readText()).optString("native") } catch (e: Exception) { "" }
            if (native == baked.optString("native") && File(webDir, "index.html").exists()) {
                return Uri.fromFile(File(webDir, "index.html")).toString()
            }
            webDir.deleteRecursively() // left over from before an APK update
        }
        return "file:///android_asset/web/index.html"
    }

    /**
     * Checks GitHub at most every few hours. Calls back with "web" once a new page is in place,
     * or "apk" when a new APK is available. Failures are silent; the next check tries again.
     */
    fun checkForUpdates(onResult: (String) -> Unit) {
        val now = System.currentTimeMillis()
        if (now - prefs.getLong(LAST_CHECK, 0) < CHECK_EVERY_MS) return
        exec.execute {
            try {
                val remote = JSONObject(httpText(BASE + "version.json"))
                prefs.edit().putLong(LAST_CHECK, now).apply()
                if (remote.optString("native") != baked.optString("native")) {
                    onResult("apk")
                } else if (remote.optString("web") != currentWeb()) {
                    installWeb()
                    onResult("web")
                }
            } catch (e: Exception) {
                // Offline or GitHub unreachable: try again on a later check.
            }
        }
    }

    /** Downloads the latest APK and hands it to the system installer (one click to confirm). */
    fun installApk(onError: (String) -> Unit) {
        exec.execute {
            try {
                download(BASE + "welcome-home.apk", File(activity.cacheDir, UpdateFileProvider.APK_NAME))
                val intent = Intent(Intent.ACTION_VIEW)
                    .setDataAndType(UpdateFileProvider.uri(activity), "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                activity.runOnUiThread { activity.startActivity(intent) }
            } catch (e: Exception) {
                onError(e.message ?: e.javaClass.simpleName)
            }
        }
    }

    fun shutdown() = exec.shutdownNow()

    private fun currentWeb(): String {
        val meta = File(webDir, "build.json")
        if (meta.exists() && pageUrl().startsWith("file:///android_asset").not()) {
            return try { JSONObject(meta.readText()).optString("web") } catch (e: Exception) { "" }
        }
        return baked.optString("web")
    }

    /** Unpacks the page into a staging folder, then swaps it in, so a failed download never leaves half a page. */
    private fun installWeb() {
        val zip = File(activity.cacheDir, "web.zip")
        download(BASE + "welcome-home-web.zip", zip)
        val staging = File(activity.filesDir, "web-new")
        staging.deleteRecursively()
        val root = staging.canonicalPath + File.separator
        ZipInputStream(zip.inputStream().buffered()).use { zin ->
            while (true) {
                val entry = zin.nextEntry ?: break
                val out = File(staging, entry.name).canonicalFile
                require(out.path.startsWith(root)) { "Unexpected path in update: ${entry.name}" }
                if (entry.isDirectory) out.mkdirs() else {
                    out.parentFile?.mkdirs()
                    out.outputStream().use { zin.copyTo(it) }
                }
            }
        }
        zip.delete()
        // The zip carries its own build.json, so a zip older than version.json just gets replaced next time.
        val meta = JSONObject(File(staging, "build.json").readText())
        require(File(staging, "index.html").exists() && meta.optString("native") == baked.optString("native"))
        webDir.deleteRecursively()
        check(staging.renameTo(webDir)) { "Couldn't move the update into place" }
    }

    private fun open(url: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15000
        conn.readTimeout = 60000
        conn.instanceFollowRedirects = true // GitHub release downloads redirect to its file CDN
        if (conn.responseCode >= 400) throw IllegalStateException("HTTP ${conn.responseCode} for $url")
        return conn
    }

    private fun httpText(url: String): String {
        val conn = open(url)
        try { return conn.inputStream.bufferedReader().use { it.readText() } } finally { conn.disconnect() }
    }

    private fun download(url: String, to: File) {
        val conn = open(url)
        try {
            val tmp = File(to.path + ".part")
            conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
            check(tmp.renameTo(to)) { "Couldn't save $to" }
        } finally {
            conn.disconnect()
        }
    }

    private companion object {
        const val BASE = "https://github.com/seedy6/seedy6/releases/download/firestick-home-latest/"
        const val LAST_CHECK = "last_check"
        const val CHECK_EVERY_MS = 3 * 60 * 60 * 1000L
    }
}
