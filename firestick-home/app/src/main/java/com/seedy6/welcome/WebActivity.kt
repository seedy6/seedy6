package com.seedy6.welcome

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

/**
 * A full-screen browser for websites opened from the home screen (Tekken hub, Munajat...).
 * Every page gets assets/tvnav.js, so the remote's arrows move between links and OK opens them.
 * Back goes to the previous page, and from the first page back to the home screen.
 */
class WebActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null
    private val navScript by lazy { assets.open("tvnav.js").bufferedReader().use { it.readText() } }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.textZoom = 100
            isFocusable = true
            isFocusableInTouchMode = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    view.evaluateJavascript(navScript, null)
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val scheme = request.url.scheme ?: return false
                    if (scheme == "http" || scheme == "https") return false
                    // mailto:, intent: and the like: hand to another app if one can open it.
                    try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: Exception) {}
                    return true
                }
            }
            // Lets videos go full-screen.
            webChromeClient = object : WebChromeClient() {
                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    fullscreenView = view
                    fullscreenCallback = callback
                    root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                    web.visibility = View.GONE
                }

                override fun onHideCustomView() = exitFullscreen()
            }
        }
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        web.loadUrl(intent.getStringExtra(EXTRA_URL) ?: "about:blank")
        web.requestFocus()
    }

    private fun exitFullscreen() {
        val view = fullscreenView ?: return
        root.removeView(view)
        fullscreenView = null
        web.visibility = View.VISIBLE
        fullscreenCallback?.onCustomViewHidden()
        fullscreenCallback = null
        web.requestFocus()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_BACK) return super.dispatchKeyEvent(event)
        if (event.action == KeyEvent.ACTION_UP) {
            when {
                fullscreenView != null -> exitFullscreen()
                web.canGoBack() -> web.goBack()
                else -> finish()
            }
        }
        return true
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "url"

        fun intent(from: Activity, url: String): Intent =
            Intent(from, WebActivity::class.java).putExtra(EXTRA_URL, Uri.parse(url).toString())
    }
}
