package com.example.ariyusone.ui.main

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.navigation3.runtime.NavKey

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
  onItemClick: (NavKey) -> Unit,
  modifier: Modifier = Modifier,
) {
  val context = LocalContext.current
  val sharedPreferences = remember {
    context.getSharedPreferences("ariyus_settings", Context.MODE_PRIVATE)
  }

  // Target URL state, reading from sharedPreferences with fallback to local development URL
  var targetUrl by remember {
    val saved = sharedPreferences.getString("target_url", "http://10.0.2.2:3000") ?: "http://10.0.2.2:3000"
    // Override old persisted production URL to force local dev server integration
    val finalUrl = if (saved == "https://ariyus-one.web.app") "http://10.0.2.2:3000" else saved
    mutableStateOf(finalUrl)
  }

  // WebView reference to reload/re-load URLs dynamically
  var webViewRef by remember { mutableStateOf<WebView?>(null) }

  // Permissions state
  val permissions = arrayOf(
    Manifest.permission.RECORD_AUDIO,
    Manifest.permission.CAMERA
  )

  var hasGrantedAll by remember {
    mutableStateOf(hasPermissions(context, permissions))
  }

  val launcher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestMultiplePermissions()
  ) { results ->
    hasGrantedAll = results.values.all { it }
  }

  // Developer settings dialog state
  var showDevDialog by remember { mutableStateOf(false) }

  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(Color(0xFF06041E)) // Dark cosmic background
  ) {
    if (hasGrantedAll) {
      // WebView container
      AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { ctx ->
          WebView(ctx).apply {
            webViewRef = this
            // Configure WebView settings for full dynamic app features
            settings.apply {
              javaScriptEnabled = true
              domStorageEnabled = true
              allowFileAccess = true
              mediaPlaybackRequiresUserGesture = false
              loadWithOverviewMode = true
              useWideViewPort = true
              mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
              cacheMode = WebSettings.LOAD_NO_CACHE
            }

            webViewClient = object : WebViewClient() {
              override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
                return false // Handle all routing inside WebView
              }
            }

            // WebChromeClient to grant resource permissions and handle file inputs
            webChromeClient = object : WebChromeClient() {
              override fun onPermissionRequest(request: PermissionRequest) {
                // Auto grant the permissions since the Android host app has them
                request.grant(request.resources)
              }

              override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
              ): Boolean {
                // Return false to allow fallback/default file chooser handling
                return false
              }
            }

            clearCache(true)
            clearHistory()
            loadUrl(targetUrl)
          }
        },
        update = { webView ->
          // Reload target URL if it changed
          if (webView.url != targetUrl) {
            webView.loadUrl(targetUrl)
          }
        }
      )

      // Small translucent settings gear floating at the top-right
      Box(
        modifier = Modifier
          .align(Alignment.TopEnd)
          .padding(top = 40.dp, end = 16.dp)
          .size(40.dp)
          .clip(RoundedCornerShape(20.dp))
          .background(Color(0x7F161233))
          .border(1.dp, Color(0x3F00F2FF), RoundedCornerShape(20.dp))
          .clickable { showDevDialog = true },
        contentAlignment = Alignment.Center
      ) {
        Text(
          text = "⚙️",
          fontSize = 18.sp,
          color = Color.White
        )
      }
    } else {
      // Cosmic Permission Request Screen
      Column(
        modifier = Modifier
          .fillMaxSize()
          .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
      ) {
        Text(
          text = "🎙️ ARIYUS-ONE 🧬",
          fontSize = 24.sp,
          fontWeight = FontWeight.Bold,
          color = Color.White,
          fontFamily = FontFamily.SansSerif,
          textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(10.dp))
        Text(
          text = "Acoustic Bio-Resonance Calibration",
          fontSize = 14.sp,
          fontWeight = FontWeight.SemiBold,
          color = Color(0xFF00F2FF),
          textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(40.dp))

        // Card detailing permissions explanation
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0x3F161233))
            .border(1.dp, Color(0x3F00F2FF), RoundedCornerShape(12.dp))
            .padding(20.dp)
        ) {
          Column {
            Text(
              text = "System Alignment Required",
              fontSize = 16.sp,
              fontWeight = FontWeight.Bold,
              color = Color.White,
              modifier = Modifier.padding(bottom = 12.dp)
            )
            Text(
              text = "To isolate your biological voice frequencies and project real-time webcam aura geometry, Ariyus-One requires permissions for:\n\n• Microphone: Captures vocal tone and detects Hertz pitch ratios.\n• Camera: Feeds real-time bioluminescent visualizers.",
              fontSize = 13.sp,
              color = Color(0xFFB0B0C5),
              lineHeight = 18.sp
            )
          }
        }

        Spacer(modifier = Modifier.height(40.dp))

        // Cosmic Glowing Button
        Button(
          onClick = { launcher.launch(permissions) },
          colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
          contentPadding = PaddingValues(),
          shape = RoundedCornerShape(24.dp),
          modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
            .border(1.dp, Color(0xFFFF00C1), RoundedCornerShape(24.dp))
            .background(
              brush = Brush.horizontalGradient(
                colors = listOf(Color(0xFF00F2FF), Color(0xFFFF00C1))
              ),
              shape = RoundedCornerShape(24.dp)
            )
        ) {
          Text(
            text = "Grant Alignment Permissions",
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp
          )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
          text = "Access can be revoked at any time in system settings.",
          fontSize = 11.sp,
          color = Color(0x7FB0B0C5),
          textAlign = TextAlign.Center
        )
      }
    }

    // Developer Settings Dialog
    if (showDevDialog) {
      var currentInputUrl by remember { mutableStateOf(targetUrl) }
      AlertDialog(
        onDismissRequest = { showDevDialog = false },
        title = {
          Text(
            text = "⚙️ Developer Target Settings",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
          )
        },
        text = {
          Column(modifier = Modifier.fillMaxWidth()) {
            Text(
              text = "Point the WebView to a local web server (IP) or production server for testing:",
              fontSize = 12.sp,
              color = Color(0xFFB0B0C5),
              modifier = Modifier.padding(bottom = 12.dp)
            )
            
            // Text field for URL
            OutlinedTextField(
              value = currentInputUrl,
              onValueChange = { currentInputUrl = it },
              modifier = Modifier.fillMaxWidth(),
              textStyle = LocalTextStyle.current.copy(color = Color.White),
              singleLine = true,
              label = { Text("Server URL", color = Color(0xFF00F2FF)) }
            )

            Spacer(modifier = Modifier.height(16.dp))
            Text(
              text = "Presets:",
              fontSize = 11.sp,
              fontWeight = FontWeight.Bold,
              color = Color.White,
              modifier = Modifier.padding(bottom = 8.dp)
            )

            // Preset Buttons Row
            Row(
              modifier = Modifier.fillMaxWidth(),
              horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
              Button(
                onClick = { currentInputUrl = "https://ariyus-one.web.app" },
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF161233))
              ) {
                Text("Production", fontSize = 11.sp, color = Color.White)
              }
              Button(
                onClick = { currentInputUrl = "http://10.0.2.2:3000" },
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF161233))
              ) {
                Text("Emulator (3000)", fontSize = 10.sp, color = Color.White)
              }
              Button(
                onClick = { currentInputUrl = "http://192.168.1.100:3000" },
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF161233))
              ) {
                Text("LAN (3000)", fontSize = 11.sp, color = Color.White)
              }
            }
          }
        },
        confirmButton = {
          Button(
            onClick = {
              targetUrl = currentInputUrl
              sharedPreferences.edit().putString("target_url", currentInputUrl).apply()
              showDevDialog = false
              // Force webView to reload with new URL
              webViewRef?.loadUrl(currentInputUrl)
            },
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF00C1))
          ) {
            Text("Save & Load", color = Color.White)
          }
        },
        dismissButton = {
          TextButton(onClick = { showDevDialog = false }) {
            Text("Cancel", color = Color(0xFFB0B0C5))
          }
        },
        containerColor = Color(0xFF0B0A26),
        tonalElevation = 6.dp
      )
    }
  }
}

// Helper to check standard android permission list
private fun hasPermissions(context: Context, permissions: Array<String>): Boolean {
  return permissions.all {
    ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
  }
}
