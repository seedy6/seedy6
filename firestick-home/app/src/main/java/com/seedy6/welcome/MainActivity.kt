package com.seedy6.welcome

import android.annotation.SuppressLint
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
    private var screenWentOff = false

    // The Fire Stick turns the screen off when it goes to sleep; coming back after that is "switching on".
    private val screenOff = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_SCREEN_OFF) screenWentOff = true
        }
    }
    private lateinit var bridge: Bridge
    lateinit var updater: Updater

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
            // Lay the page out at the width its viewport meta asks for (1920) and zoom it to fit the
            // screen, instead of the TV's 960-wide CSS viewport; ignore system font scaling.
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.textZoom = 100
            isFocusable = true
            isFocusableInTouchMode = true
            webViewClient = WebViewClient()
        }
        updater = Updater(this)
        bridge = Bridge(this)
        web.addJavascriptInterface(bridge, "Android")
        setContentView(web)
        web.loadUrl(updater.pageUrl())
        registerReceiver(screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF))
        web.requestFocus()
    }

    override fun onResume() {
        super.onResume()
        HomePrefs.setRedirectPaused(this, false) // back on Welcome Home, so Home leads here again
        HomeSwitch.ensureOn(this) // in case Fire OS cleared the redirect
        web.onResume()
        web.resumeTimers()
        if (screenWentOff) {
            screenWentOff = false
            js("window.onWake && onWake()") // before onHomeResume, which skips its own check while the intro plays
        }
        js("window.onHomeResume && onHomeResume()")
        // Automatic checks only speak up when there is something new.
        updater.checkForUpdates { result ->
            if (result == "web" || result == "apk") js("window.onUpdate && onUpdate('$result')")
        }
    }

    /** Loads the newest page (after a downloaded update) without replaying the intro. */
    fun reloadPage() {
        web.post { web.loadUrl(updater.pageUrl() + "?nointro") }
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
        unregisterReceiver(screenOff)
        bridge.shutdown()
        updater.shutdown()
        web.destroy()
        super.onDestroy()
    }
}
