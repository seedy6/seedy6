package com.seedy6.welcome

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Opens Welcome Home when the Fire Stick starts, and ends any "Fire TV home" pause. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        HomePrefs.setRedirectPaused(context, false)
        HomeSwitch.ensureOn(context) // Fire OS can clear it across a restart
        context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
