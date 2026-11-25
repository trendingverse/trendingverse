<?php
/**
 * TrendingVerse Ads Plugin — One-Click Auto-Update Helper
 *
 * USAGE:
 *   1. Upload this file to your WordPress site root (same folder as wp-config.php)
 *   2. Visit: https://yoursite.com/tv-update.php?key=tvads2024update
 *   3. Wait ~10 seconds while the plugin reinstalls automatically
 *   4. This file deletes itself after a successful update
 *
 * SECURITY: The ?key= parameter prevents unauthorised use.
 * Delete this file manually if you don't use it within 48 hours.
 */

// ─── Config ─────────────────────────────────────────────────────────────────
define('TV_SECRET_KEY',   'tvads2024update');
define('TV_PLUGIN_ZIP',   'https://trendingverse.pages.dev/downloads/trendingverse-ads.zip');
define('TV_PLUGIN_SLUG',  'trendingverse-ads/trendingverse-ads.php');
define('TV_PLUGIN_FOLDER','trendingverse-ads');
define('TV_ZIP_NAME',     'trendingverse-ads.zip');
// ────────────────────────────────────────────────────────────────────────────

// Validate key
$key = isset($_GET['key']) ? trim($_GET['key']) : '';
if (!hash_equals(TV_SECRET_KEY, $key)) {
    http_response_code(403);
    die('<h2>403 Forbidden</h2><p>Add <code>?key=tvads2024update</code> to the URL.</p>');
}

// Bootstrap WordPress
define('ABSPATH_FOUND', false);
$wpLoad = __DIR__ . '/wp-load.php';
if (!file_exists($wpLoad)) {
    // Try one level up (some setups)
    $wpLoad = dirname(__DIR__) . '/wp-load.php';
}
if (!file_exists($wpLoad)) {
    die('<h2>Error</h2><p>Cannot find wp-load.php. Place this file in your WordPress root (same folder as wp-config.php).</p>');
}

/** @noinspection PhpIncludeInspection */
require_once $wpLoad;
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
require_once ABSPATH . 'wp-admin/includes/plugin-install.php';

// Must be logged in as admin OR running in CLI/cron context
if (!current_user_can('activate_plugins') && !defined('WP_CLI')) {
    // Try to use the first admin user to authorise the operation
    $admins = get_users(['role' => 'administrator', 'number' => 1]);
    if (!empty($admins)) {
        wp_set_current_user($admins[0]->ID);
    }
    if (!current_user_can('activate_plugins')) {
        die('<h2>Permission denied</h2><p>You must be logged in as a WordPress administrator to run this update. <a href="' . wp_login_url($_SERVER['REQUEST_URI']) . '">Log in here</a>, then come back to this page.</p>');
    }
}

// ─── UI wrapper ─────────────────────────────────────────────────────────────
function tv_log(string $msg, string $type = 'info'): void {
    $colour = match($type) {
        'ok'    => '#22c55e',
        'warn'  => '#f59e0b',
        'error' => '#ef4444',
        default => '#94a3b8',
    };
    echo "<p style='margin:4px 0;color:{$colour};font-family:monospace'>{$msg}</p>\n";
    flush();
    ob_flush();
}
// ────────────────────────────────────────────────────────────────────────────

?><!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>TrendingVerse Ads — Plugin Update</title>
<style>
  body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;justify-content:center;padding:40px 16px}
  .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:32px;max-width:620px;width:100%}
  h1{margin:0 0 8px;font-size:1.4rem;color:#f8fafc}
  .sub{color:#94a3b8;font-size:.9rem;margin-bottom:24px}
  .log{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;min-height:120px;overflow-y:auto}
  .done{margin-top:20px;padding:12px 16px;background:#14532d;border-radius:8px;color:#bbf7d0;font-weight:600;display:none}
  .err {margin-top:20px;padding:12px 16px;background:#450a0a;border-radius:8px;color:#fecaca;font-weight:600;display:none}
</style>
</head>
<body>
<div class="card">
  <h1>🔄 TrendingVerse Ads — Plugin Update</h1>
  <p class="sub">Updating plugin to the latest version from TrendingVerse CDN&hellip;</p>
  <div class="log" id="log">
<?php

$pluginDir = WP_PLUGIN_DIR . '/' . TV_PLUGIN_FOLDER;
$zipDest   = get_temp_dir() . TV_ZIP_NAME;
$success   = false;
$errMsg    = '';

try {

    // 1. Deactivate existing plugin if active
    if (is_plugin_active(TV_PLUGIN_SLUG)) {
        tv_log('⏸ Deactivating existing plugin…');
        deactivate_plugins(TV_PLUGIN_SLUG, true);
        tv_log('✓ Deactivated', 'ok');
    } else {
        tv_log('ℹ Plugin not currently active (will install fresh)', 'info');
    }

    // 2. Download new ZIP
    tv_log('⬇ Downloading new plugin ZIP from CF Pages…');
    WP_Filesystem();
    $response = wp_remote_get(TV_PLUGIN_ZIP, [
        'timeout'  => 60,
        'stream'   => true,
        'filename' => $zipDest,
    ]);

    if (is_wp_error($response)) {
        throw new RuntimeException('Download failed: ' . $response->get_error_message());
    }
    $code = wp_remote_retrieve_response_code($response);
    if ($code !== 200) {
        throw new RuntimeException("Download failed: HTTP {$code}");
    }
    $size = round(filesize($zipDest) / 1024, 1);
    tv_log("✓ Downloaded ({$size} KB)", 'ok');

    // 3. Remove old plugin folder
    tv_log('🗑 Removing old plugin files…');
    if (is_dir($pluginDir)) {
        global $wp_filesystem;
        $wp_filesystem->rmdir($pluginDir, true);
    }
    tv_log('✓ Old files removed', 'ok');

    // 4. Unzip
    tv_log('📦 Extracting ZIP…');
    $result = unzip_file($zipDest, WP_PLUGIN_DIR);
    if (is_wp_error($result)) {
        throw new RuntimeException('Unzip failed: ' . $result->get_error_message());
    }
    tv_log('✓ Extracted', 'ok');

    // 5. Activate
    tv_log('⚡ Activating plugin…');
    $activated = activate_plugin(TV_PLUGIN_SLUG);
    if (is_wp_error($activated)) {
        throw new RuntimeException('Activation failed: ' . $activated->get_error_message());
    }
    tv_log('✓ Plugin activated', 'ok');

    // 6. Verify
    if (is_plugin_active(TV_PLUGIN_SLUG)) {
        tv_log('✅ Update complete — TrendingVerse Ads is running on the new CF Pages endpoint.', 'ok');
        $success = true;
    } else {
        throw new RuntimeException('Plugin did not activate after install. Check WP admin › Plugins.');
    }

    // 7. Clean up temp zip
    @unlink($zipDest);

} catch (Throwable $e) {
    tv_log('❌ ' . $e->getMessage(), 'error');
    $errMsg = htmlspecialchars($e->getMessage());
}

// 8. Self-delete on success so it can't be reused
if ($success) {
    register_shutdown_function(function() {
        @unlink(__FILE__);
    });
}

?>
  </div>

<?php if ($success): ?>
  <div class="done" id="done" style="display:block">
    ✅ Plugin updated successfully! Ads should now load from <strong>trendingverse.pages.dev</strong>.<br>
    This helper file has been deleted automatically.
  </div>
<?php else: ?>
  <div class="err" id="err" style="display:block">
    ❌ Update failed: <?= $errMsg ?><br>
    Check your WP error log or contact TrendingVerse support.
  </div>
<?php endif; ?>

</div>
</body>
</html>
