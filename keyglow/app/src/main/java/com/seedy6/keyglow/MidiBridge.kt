package com.seedy6.keyglow

import android.content.Context
import android.content.pm.PackageManager
import android.media.midi.MidiDevice
import android.media.midi.MidiDeviceInfo
import android.media.midi.MidiManager
import android.media.midi.MidiOutputPort
import android.media.midi.MidiReceiver
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject

/**
 * Listens to every MIDI keyboard plugged in over USB (or a Bluetooth MIDI device already paired),
 * and hands each note on / note off / sustain message to [onMessage].
 * A keyboard over MIDI is exact, so the page prefers it to the microphone when one is connected.
 */
class MidiBridge(
    private val context: Context,
    private val onMessage: (status: Int, d1: Int, d2: Int) -> Unit
) {
    var onDevicesChanged: (() -> Unit)? = null
    val supported: Boolean = context.packageManager.hasSystemFeature(PackageManager.FEATURE_MIDI)

    private val handler = Handler(Looper.getMainLooper())
    private val manager: MidiManager? =
        if (supported) context.getSystemService(Context.MIDI_SERVICE) as? MidiManager else null
    private val open = mutableMapOf<Int, Pair<MidiDevice, List<MidiOutputPort>>>()
    private val names = mutableMapOf<Int, String>()

    private val callback = object : MidiManager.DeviceCallback() {
        override fun onDeviceAdded(device: MidiDeviceInfo) {
            openDevice(device)
        }

        override fun onDeviceRemoved(device: MidiDeviceInfo) {
            closeDevice(device.id)
            onDevicesChanged?.invoke()
        }
    }

    fun start() {
        val m = manager ?: return
        @Suppress("DEPRECATION")
        m.devices.forEach { openDevice(it) }
        m.registerDeviceCallback(callback, handler)
    }

    fun stop() {
        manager?.unregisterDeviceCallback(callback)
        open.keys.toList().forEach { closeDevice(it) }
    }

    fun devicesJson(): String {
        val arr = JSONArray()
        names.forEach { (id, name) -> arr.put(JSONObject().put("id", id).put("name", name)) }
        return arr.toString()
    }

    private fun openDevice(info: MidiDeviceInfo) {
        val m = manager ?: return
        if (info.outputPortCount == 0 || open.containsKey(info.id)) return
        val props = info.properties
        val name = props.getString(MidiDeviceInfo.PROPERTY_NAME)
            ?: listOfNotNull(
                props.getString(MidiDeviceInfo.PROPERTY_MANUFACTURER),
                props.getString(MidiDeviceInfo.PROPERTY_PRODUCT)
            ).joinToString(" ").ifBlank { "MIDI keyboard" }
        m.openDevice(info, { device ->
            if (device == null) return@openDevice
            val ports = (0 until info.outputPortCount).mapNotNull { i ->
                device.openOutputPort(i)?.also { it.connect(Parser()) }
            }
            open[info.id] = device to ports
            names[info.id] = name
            onDevicesChanged?.invoke()
        }, handler)
    }

    private fun closeDevice(id: Int) {
        open.remove(id)?.let { (device, ports) ->
            ports.forEach { try { it.close() } catch (e: Exception) {} }
            try { device.close() } catch (e: Exception) {}
        }
        names.remove(id)
    }

    /** Splits the raw byte stream into channel messages, following running status. */
    private inner class Parser : MidiReceiver() {
        private var status = 0
        private val data = IntArray(2)
        private var count = 0

        override fun onSend(msg: ByteArray, offset: Int, length: Int, timestamp: Long) {
            for (i in offset until offset + length) {
                val b = msg[i].toInt() and 0xFF
                when {
                    b >= 0xF8 -> {} // real-time (clock, active sensing): ignore
                    b >= 0xF0 -> { status = 0; count = 0 } // system common / sysex: drop
                    b >= 0x80 -> { status = b; count = 0 }
                    status != 0 -> {
                        data[count++] = b
                        val needed = if ((status and 0xF0) == 0xC0 || (status and 0xF0) == 0xD0) 1 else 2
                        if (count >= needed) {
                            val type = status and 0xF0
                            if (type == 0x80 || type == 0x90 || type == 0xB0) {
                                onMessage(status, data[0], if (needed == 2) data[1] else 0)
                            }
                            count = 0
                        }
                    }
                }
            }
        }
    }
}
