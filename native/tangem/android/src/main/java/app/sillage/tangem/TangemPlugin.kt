package app.sillage.tangem

import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.tangem.TangemSdk
import com.tangem.common.CompletionResult
import com.tangem.common.card.EllipticCurve
import com.tangem.common.core.Config
import com.tangem.common.core.TangemError
import com.tangem.common.core.TangemSdkError
import com.tangem.common.services.secure.SecureStorage
import com.tangem.crypto.bip39.Wordlist
import com.tangem.sdk.DefaultSessionViewDelegate
import com.tangem.sdk.extensions.getWordlist
import com.tangem.sdk.extensions.initAuthenticationManager
import com.tangem.sdk.extensions.initKeystoreManager
import com.tangem.sdk.extensions.initNfcManager
import com.tangem.sdk.extensions.localizedDescription
import com.tangem.sdk.nfc.AndroidNfcAvailabilityProvider
import com.tangem.sdk.storage.create

// Tangem cards in the Android app. The card keeps an Ed25519 key that never leaves it: the app only asks it to sign,
// and src/lib/cards.ts turns the (deterministic, RFC 8032) signature into the card's secret.
@CapacitorPlugin(name = "Tangem")
class TangemPlugin : Plugin() {
    private lateinit var sdk: TangemSdk

    override fun load() {
        val activity = getActivity()
        val config = Config()
        val secureStorage = SecureStorage.create(activity)
        val nfcManager = TangemSdk.initNfcManager(activity)
        val authenticationManager = TangemSdk.initAuthenticationManager(activity)
        val keystoreManager = TangemSdk.initKeystoreManager(authenticationManager, secureStorage)
        val viewDelegate = DefaultSessionViewDelegate(nfcManager, activity).also { it.sdkConfig = config }
        sdk = TangemSdk(
            reader = nfcManager.reader,
            viewDelegate = viewDelegate,
            nfcAvailabilityProvider = AndroidNfcAvailabilityProvider(activity),
            secureStorage = secureStorage,
            wordlist = Wordlist.getWordlist(activity),
            authenticationManager = authenticationManager,
            keystoreManager = keystoreManager,
            config = config,
        )
    }

    // The card and its Ed25519 key, created at its very first use (one more tap).
    @PluginMethod
    fun scan(call: PluginCall) {
        sdk.scanCard(initialMessage = null) { result ->
            when (result) {
                is CompletionResult.Failure -> fail(call, result.error)
                is CompletionResult.Success -> {
                    val card = result.data
                    val wallet = card.wallets.firstOrNull { it.curve == EllipticCurve.Ed25519 }
                    if (wallet != null) {
                        call.resolve(JSObject().put("cardId", card.cardId).put("publicKey", hex(wallet.publicKey)))
                    } else {
                        sdk.createWallet(curve = EllipticCurve.Ed25519, cardId = card.cardId, initialMessage = null) { created ->
                            when (created) {
                                is CompletionResult.Failure -> fail(call, created.error)
                                is CompletionResult.Success -> call.resolve(JSObject().put("cardId", card.cardId).put("publicKey", hex(created.data.wallet.publicKey)))
                            }
                        }
                    }
                }
            }
        }
    }

    // Signs a 32-byte value (base64) with the card's key; the card must be the one scanned (same id).
    @PluginMethod
    fun sign(call: PluginCall) {
        val cardId = call.getString("cardId")
        val publicKey = call.getString("publicKey")?.let(::bytes)
        val hash = call.getString("hash")?.let { Base64.decode(it, Base64.NO_WRAP) }
        if (cardId == null || publicKey == null || hash == null) return call.reject("Paramètres manquants.")
        sdk.sign(hashes = arrayOf(hash), walletPublicKey = publicKey, cardId = cardId, derivationPath = null, initialMessage = null) { result ->
            when (result) {
                is CompletionResult.Failure -> fail(call, result.error)
                is CompletionResult.Success -> call.resolve(JSObject().put("signature", Base64.encodeToString(result.data.signatures.first(), Base64.NO_WRAP)))
            }
        }
    }

    private fun fail(call: PluginCall, error: TangemError) =
        call.reject((error as? TangemSdkError)?.localizedDescription(context) ?: error.customMessage, error.code.toString())

    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }

    private fun bytes(hex: String): ByteArray? =
        if (hex.length % 2 != 0) null else runCatching { ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() } }.getOrNull()
}
