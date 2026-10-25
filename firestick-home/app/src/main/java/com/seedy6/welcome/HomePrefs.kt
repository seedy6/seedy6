package com.seedy6.welcome

import android.content.Context

/** Whether the Home-button redirect is paused because the user chose to go to the Fire TV home screen. */
object HomePrefs {
    private const val FILE = "home"
    private const val PAUSED = "redirect_paused"

    fun isRedirectPaused(context: Context) =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getBoolean(PAUSED, false)

    fun setRedirectPaused(context: Context, paused: Boolean) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putBoolean(PAUSED, paused).apply()
    }
}
