package com.seedy6.welcome

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import org.json.JSONArray

/**
 * A full-screen browser for websites opened from the home screen (Tekken hub, Munajat...).
 * Every page gets assets/tvnav.js, so the remote's arrows move between links and OK opens them.
 * Back goes to the previous page, and from the first page back to the home screen.
 * Menu shows a diagnostics panel: page errors, failed requests and what the page is showing.
 */
class WebActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null
    private val navScript by lazy { assets.open("tvnav.js").bufferedReader().use { it.readText() } }
    private lateinit var diag: TextView
    private val problems = ArrayDeque<String>()
    private var pageNote = ""

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION") // databaseEnabled
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.javaScriptCanOpenWindowsAutomatically = true // pop-ups (Twitch) open in this view
            settings.textZoom = 100
            // Without "; wv" sites (Twitch) treat it as the full Chrome it is, not a limited in-app view.
            settings.userAgentString = settings.userAgentString.replace("; wv)", ")")
            isFocusable = true
            isFocusableInTouchMode = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    view.evaluateJavascript(navScript, null)
                    // A few seconds later, note what the page is showing (e.g. stuck on "Loading…").
                    view.postDelayed({ notePageText() }, 6000)
                }

                override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                    report("HTTP ${response.statusCode} ${request.method} ${request.url}")
                }

                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    report("Failed ${request.url}: ${error.description}")
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val scheme = request.url.scheme ?: return false
                    if (scheme == "http" || scheme == "https") return false
                    // mailto:, intent: and the like: hand to another app if one can open it.
                    try { startActivity(Intent(Intent.ACTION_VIEW, request.url)) } catch (e: Exception) {}
                    return true
                }
            }
            // Lets videos go full-screen, and passes page errors to the diagnostics panel.
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    if (message.messageLevel() == ConsoleMessage.MessageLevel.ERROR ||
                        message.messageLevel() == ConsoleMessage.MessageLevel.WARNING) {
                        report("${message.messageLevel()}: ${message.message()} (${message.sourceId().substringAfterLast('/')}:${message.lineNumber()})")
                    }
                    return false
                }

                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    fullscreenView = view
                    fullscreenCallback = callback
                    root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                    web.visibility = View.GONE
                }

                override fun onHideCustomView() = exitFullscreen()
            }
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true) // Twitch embeds
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        diag = TextView(this).apply {
            setBackgroundColor(Color.argb(225, 10, 6, 6))
            setTextColor(Color.rgb(255, 214, 160))
            typeface = Typeface.MONOSPACE
            textSize = 11f
            setPadding(24, 16, 24, 16)
            maxLines = 18
            visibility = View.GONE
        }
        root.addView(diag, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        setContentView(root)
        web.loadUrl(intent.getStringExtra(EXTRA_URL) ?: "about:blank")
        // Starting a new page clears the panel's list.
        problems.clear()
        web.requestFocus()
    }

    /** Adds a line to the diagnostics panel (shown with Menu, so a missing favicon doesn't cover the page). */
    private fun report(line: String) = runOnUiThread {
        problems.addLast(line.take(220))
        while (problems.size > 8) problems.removeFirst()
        if (diag.visibility == View.VISIBLE) showDiagnostics(true)
    }

    /**
     * Notes what the page shows, its load state, the files it has loaded (with ms), and a fetch test of the page
     * and its scripts: a file that stays "pending" is one the page is stuck waiting for.
     */
    private fun notePageText() {
        val js = """(function(){
            var m=document.querySelector('main')||document.body;
            var text=(document.title+' | '+(m?m.innerText:'')).replace(/\s+/g,' ').slice(0,160);
            var p=window.__tvProbe;
            if(!p){p=window.__tvProbe={};
              [location.href.split('#')[0]].concat([].slice.call(document.scripts).map(function(s){return s.src;}).filter(Boolean)).slice(0,4).forEach(function(u){
                var k=u.split('/').pop()||'/',t0=Date.now();p[k]='pending';
                fetch(u,{cache:'no-store'}).then(function(r){return r.text().then(function(b){p[k]=r.status+' '+b.length+'B '+(Date.now()-t0)+'ms';});},function(e){p[k]='failed '+e.message;});
              });}
            var loaded=performance.getEntriesByType('resource').map(function(e){return e.name.split('?')[0].split('/').pop()+' '+Math.round(e.duration);}).join(', ');
            return text+'\nState: '+document.readyState+' · Fetch test: '+Object.keys(p).map(function(k){return k+' '+p[k];}).join(', ')+
              '\nLoaded: '+(loaded||'nothing').slice(0,420);
        })()"""
        web.evaluateJavascript(js) { result ->
            pageNote = try { JSONArray("[$result]").optString(0) } catch (e: Exception) { result ?: "" }
            if (diag.visibility == View.VISIBLE) showDiagnostics(true)
        }
    }

    private fun showDiagnostics(show: Boolean) {
        if (!show) { diag.visibility = View.GONE; return }
        val chrome = Regex("Chrome/([0-9.]+)").find(web.settings.userAgentString)?.groupValues?.get(1) ?: "?"
        diag.text = buildString {
            append("Diagnostics (Menu to hide) · Chrome $chrome · ${web.url}\n")
            append("Page shows: ").append(pageNote.ifEmpty { "(checking…)" }).append('\n')
            if (problems.isEmpty()) append("No errors or failed requests.") else problems.forEach { append("• ").append(it).append('\n') }
        }
        diag.visibility = View.VISIBLE
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
        if (event.keyCode == KeyEvent.KEYCODE_MENU) {
            if (event.action == KeyEvent.ACTION_UP) {
                notePageText()
                // The fetch test needs a moment: refresh the panel once it has answered.
                web.postDelayed({ notePageText() }, 3000)
                showDiagnostics(diag.visibility != View.VISIBLE)
            }
            return true
        }
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

    // pauseTimers() and resumeTimers() act on every WebView in the app. The home screen pauses them when this
    // browser opens over it, so resume them here, or module scripts, fetches and timers stop (blank Lab and Scrolls).
    override fun onResume() {
        super.onResume()
        web.onResume()
        web.resumeTimers()
    }

    override fun onPause() {
        web.onPause()
        web.pauseTimers()
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
