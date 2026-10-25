package com.seedy6.welcome

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings

/**
 * The Home-button redirect is an accessibility service, switched on through secure settings.
 * Fire OS doesn't list it in its menus and can clear it (e.g. on restart), so once the user has
 * granted WRITE_SECURE_SETTINGS over ADB, the app switches it back on itself.
 */
object HomeSwitch {
    private fun service(context: Context) = ComponentName(context, HomeRedirectService::class.java)

    private fun enabledList(context: Context): List<String> =
        (Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: "")
            .split(':').filter { it.isNotBlank() && it != "null" }

    fun isOn(context: Context): Boolean {
        val mine = service(context)
        return enabledList(context).any { ComponentName.unflattenFromString(it) == mine }
    }

    fun canSwitchOn(context: Context) =
        context.checkCallingOrSelfPermission(android.Manifest.permission.WRITE_SECURE_SETTINGS) ==
            PackageManager.PERMISSION_GRANTED

    /** Turns the redirect on if it's off and we're allowed to. Returns whether it's on afterwards. */
    fun ensureOn(context: Context): Boolean {
        if (isOn(context)) return true
        if (!canSwitchOn(context)) return false
        return try {
            val resolver = context.contentResolver
            val list = enabledList(context) + service(context).flattenToString()
            Settings.Secure.putString(resolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, list.joinToString(":"))
            Settings.Secure.putInt(resolver, Settings.Secure.ACCESSIBILITY_ENABLED, 1)
            isOn(context)
        } catch (e: SecurityException) {
            false
        }
    }
}
