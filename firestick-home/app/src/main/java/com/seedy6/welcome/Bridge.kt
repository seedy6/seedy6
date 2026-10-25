package com.seedy6.welcome

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/** Exposed to the page as `window.Android`. */
class Bridge(private val activity: MainActivity) {
    private val pool = Executors.newFixedThreadPool(3)
    private val pm get() = activity.packageManager

    /** Every launchable app as JSON: [{pkg, label, banner, icon}], icon being a PNG data URL. */
    @JavascriptInterface
    fun getApps(): String {
        val apps = LinkedHashMap<String, JSONObject>()
        for (category in listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)) {
            val query = Intent(Intent.ACTION_MAIN).addCategory(category)
            for (info in pm.queryIntentActivities(query, 0)) {
                val activityInfo = info.activityInfo
                val pkg = activityInfo.packageName
                if (pkg == activity.packageName || pkg in apps) continue
                val banner = activityInfo.loadBanner(pm) ?: activityInfo.applicationInfo.loadBanner(pm)
                apps[pkg] = JSONObject()
                    .put("pkg", pkg)
                    .put("label", info.loadLabel(pm).toString())
                    .put("banner", banner != null)
                    .put("icon", toDataUrl(banner ?: info.loadIcon(pm), banner != null))
            }
        }
        return JSONArray(apps.values).toString()
    }

    @JavascriptInterface
    fun launch(pkg: String): Boolean {
        val intent = pm.getLeanbackLaunchIntentForPackage(pkg)
            ?: pm.getLaunchIntentForPackage(pkg)
            ?: return false
        activity.runOnUiThread { activity.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        return true
    }

    @JavascriptInterface
    fun openSettings() {
        activity.runOnUiThread {
            activity.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    /**
     * GET [url] off the UI thread and answer through window.__bridgeResolve(id, ok, body).
     * Done natively so the Mac mini needs no CORS headers and plain http works.
     */
    @JavascriptInterface
    fun fetch(id: String, url: String) {
        pool.execute {
            val (ok, body) = try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 8000
                try {
                    val code = conn.responseCode
                    val stream = if (code < 400) conn.inputStream else conn.errorStream
                    (code < 400) to (stream?.bufferedReader()?.use { it.readText() } ?: "HTTP $code")
                } finally {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                false to (e.message ?: e.javaClass.simpleName)
            }
            activity.js("window.__bridgeResolve(${JSONObject.quote(id)}, $ok, ${JSONObject.quote(body)})")
        }
    }

    fun shutdown() = pool.shutdownNow()

    private fun toDataUrl(drawable: Drawable, isBanner: Boolean): String {
        val (w, h) = if (isBanner) 320 to 180 else 160 to 160
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, w, h)
        drawable.draw(Canvas(bitmap))
        val png = ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        bitmap.recycle()
        return "data:image/png;base64," + Base64.encodeToString(png.toByteArray(), Base64.NO_WRAP)
    }
}
