package com.seedy6.welcome

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * Lets the system installer read a downloaded update APK. Android 7+ won't accept file:// paths
 * from another app, and this project has no AndroidX, so this stands in for FileProvider.
 * It serves exactly one file, read-only.
 */
class UpdateFileProvider : ContentProvider() {
    override fun onCreate() = true

    private fun apk(uri: Uri): File {
        if (uri.lastPathSegment != APK_NAME) throw FileNotFoundException(uri.toString())
        return File(context!!.cacheDir, APK_NAME)
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor =
        ParcelFileDescriptor.open(apk(uri), ParcelFileDescriptor.MODE_READ_ONLY)

    override fun getType(uri: Uri) = "application/vnd.android.package-archive"

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, args: Array<out String>?, sort: String?): Cursor {
        val file = apk(uri)
        return MatrixCursor(arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)).apply {
            addRow(arrayOf<Any>(APK_NAME, file.length()))
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException()
    override fun update(uri: Uri, values: ContentValues?, selection: String?, args: Array<out String>?) = 0
    override fun delete(uri: Uri, selection: String?, args: Array<out String>?) = 0

    companion object {
        const val APK_NAME = "update.apk"
        fun uri(context: Context): Uri = Uri.parse("content://${context.packageName}.updates/$APK_NAME")
    }
}
