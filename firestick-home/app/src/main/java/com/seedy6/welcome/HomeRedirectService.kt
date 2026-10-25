package com.seedy6.welcome

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

/**
 * Fire OS always sends the Home button to Amazon's launcher. When this service is switched
 * on, it notices Amazon's home screen appearing and brings Welcome Home to the front.
 * The package filter in res/xml/home_redirect_service.xml means it only hears about the
 * stock launcher, nothing else on the device.
 */
class HomeRedirectService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg !in STOCK_LAUNCHERS) return
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        )
    }

    override fun onInterrupt() {}

    private companion object {
        val STOCK_LAUNCHERS = setOf("com.amazon.tv.launcher", "com.amazon.firehomestarter")
    }
}
