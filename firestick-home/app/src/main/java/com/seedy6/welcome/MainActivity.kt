package com.seedy6.welcome

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * The home screen itself is a web page in assets/web, so the design can change without
 * touching Kotlin. This activity only hosts it and forwards the remote's special keys.
 */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var bridge: Bridge

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true) // chrome://inspect over ADB
        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = true
            isFocusable = true
            isFocusableInTouchMode = true
            webViewClient = WebViewClient()
        }
        bridge = Bridge(this)
        web.addJavascriptInterface(bridge, "Android")
        setContentView(web)
        web.loadUrl("file:///android_asset/web/index.html")
        web.requestFocus()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        web.resumeTimers()
        js("window.onHomeResume && onHomeResume()")
    }

    // Stop animations and timers while another app is on screen; the Fire Stick has little CPU to spare.
    override fun onPause() {
        web.onPause()
        web.pauseTimers()
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        js("window.onHomePressed && onHomePressed()")
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val hook = when (event.keyCode) {
            KeyEvent.KEYCODE_BACK -> "onBackKey"
            KeyEvent.KEYCODE_MENU -> "onMenuKey"
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "replayIntro"
            else -> return super.dispatchKeyEvent(event)
        }
        // Handle on key-up only; swallow the key-down so Back never leaves the launcher.
        if (event.action == KeyEvent.ACTION_UP) js("window.$hook && $hook()")
        return true
    }

    fun js(code: String) {
        web.post { web.evaluateJavascript(code, null) }
    }

    override fun onDestroy() {
        bridge.shutdown()
        web.destroy()
        super.onDestroy()
    }
}
