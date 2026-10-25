package com.seedy6.welcome

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper

/** Opens Welcome Home when the Fire Stick starts, and ends any "Fire TV home" pause. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        HomePrefs.setRedirectPaused(context, false)
        HomeSwitch.ensureOn(context) // Fire OS can clear it across a restart
        // Wait until Fire TV has finished bringing up its own home screen, so the intro plays where it
        // can be seen instead of behind the start-up screens. (Receivers get 10 s; this uses 6.)
        val pending = goAsync()
        Handler(Looper.getMainLooper()).postDelayed({
            context.startActivity(Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            pending.finish()
        }, 6000)
    }
}
