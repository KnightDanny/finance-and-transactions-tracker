package expo.modules.smsreader

import android.content.ContentResolver
import android.database.Cursor
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    // Read SMS messages from the inbox, optionally filtered by timestamp
    AsyncFunction("getMessages") { afterTimestamp: Long ->
      val context = appContext.reactContext ?: throw Exception("React context is null")
      val contentResolver: ContentResolver = context.contentResolver
      val smsList = mutableListOf<Map<String, Any>>()

      // Query content://sms with type=1 (received) rather than content://sms/inbox:
      // Samsung/OneUI message categorization hides some senders (e.g. "Awash Bank")
      // from the /inbox URI even though they are ordinary received SMS.
      val uri = Uri.parse("content://sms")
      val projection = arrayOf("_id", "address", "body", "date", "read")
      val selection = if (afterTimestamp > 0) "type = 1 AND date > ?" else "type = 1"
      val selectionArgs = if (afterTimestamp > 0) arrayOf(afterTimestamp.toString()) else null
      val sortOrder = "date ASC"

      var cursor: Cursor? = null
      try {
        cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)
        cursor?.let {
          val idIdx = it.getColumnIndex("_id")
          val addressIdx = it.getColumnIndex("address")
          val bodyIdx = it.getColumnIndex("body")
          val dateIdx = it.getColumnIndex("date")
          val readIdx = it.getColumnIndex("read")

          while (it.moveToNext()) {
            val sms = mapOf(
              "id" to it.getString(idIdx),
              "address" to (it.getString(addressIdx) ?: ""),
              "body" to (it.getString(bodyIdx) ?: ""),
              "date" to it.getLong(dateIdx),
              "read" to it.getInt(readIdx)
            )
            smsList.add(sms)
          }
        }
      } finally {
        cursor?.close()
      }

      return@AsyncFunction smsList
    }
  }
}
