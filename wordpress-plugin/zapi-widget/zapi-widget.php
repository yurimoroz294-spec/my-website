<?php
/**
 * Plugin Name: Zapi Widget
 * Plugin URI:  https://zapi.cz
 * Description: Přidá AI zákaznický chat Zapi na váš e-shop. Stačí zadat API klíč v nastavení.
 * Version:     1.0.0
 * Author:      Zapi
 * Author URI:  https://zapi.cz
 * License:     GPL-2.0-or-later
 * Text Domain: zapi-widget
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'ZAPI_VERSION',     '1.0.0' );
define( 'ZAPI_OPTION_KEY',  'zapi_api_key' );
define( 'ZAPI_WIDGET_URL',  'https://cdn.zapi.cz/widget.js' );

// ── Admin settings page ───────────────────────────────────────────────────────

add_action( 'admin_menu', function () {
    add_options_page(
        'Zapi Widget',
        'Zapi Chat',
        'manage_options',
        'zapi-widget',
        'zapi_settings_page'
    );
} );

add_action( 'admin_init', function () {
    register_setting( 'zapi_settings', ZAPI_OPTION_KEY, [
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => '',
    ] );
} );

function zapi_settings_page() {
    $api_key = get_option( ZAPI_OPTION_KEY, '' );
    $saved   = isset( $_GET['settings-updated'] );
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:10px">
            <span style="font-size:28px;font-weight:800;letter-spacing:-1px">Z<span style="color:#4f6ef7">api</span></span>
            <span style="font-size:14px;font-weight:400;color:#666">AI zákaznický chat</span>
        </h1>

        <?php if ( $saved && $api_key ) : ?>
        <div class="notice notice-success is-dismissible">
            <p>✅ Widget je aktivní a zobrazuje se na vašem webu!</p>
        </div>
        <?php elseif ( $saved && ! $api_key ) : ?>
        <div class="notice notice-warning is-dismissible">
            <p>⚠️ API klíč byl odstraněn — widget je nyní deaktivován.</p>
        </div>
        <?php endif; ?>

        <div style="max-width:600px;margin-top:20px">
            <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:24px;margin-bottom:20px">
                <h2 style="margin-top:0;font-size:16px">Nastavení widgetu</h2>
                <form method="post" action="options.php">
                    <?php settings_fields( 'zapi_settings' ); ?>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row">
                                <label for="zapi_api_key">API klíč</label>
                            </th>
                            <td>
                                <input
                                    type="text"
                                    id="zapi_api_key"
                                    name="<?php echo esc_attr( ZAPI_OPTION_KEY ); ?>"
                                    value="<?php echo esc_attr( $api_key ); ?>"
                                    class="regular-text"
                                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                    autocomplete="off"
                                />
                                <p class="description">
                                    Najdete ho v <a href="https://app.zapi.cz/dashboard.html" target="_blank">Zapi dashboardu</a> → Přehled → API klíč.
                                </p>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button( 'Uložit nastavení' ); ?>
                </form>
            </div>

            <?php if ( $api_key ) : ?>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px">
                <strong style="color:#166534">✅ Widget je aktivní</strong>
                <p style="margin:8px 0 0;font-size:13px;color:#166534">
                    Chat se zobrazuje na všech stránkách vašeho webu.
                    <a href="<?php echo esc_url( home_url() ); ?>" target="_blank">Otevřít web →</a>
                </p>
            </div>
            <?php else : ?>
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px 20px">
                <strong style="color:#92400e">⚠️ Widget není aktivní</strong>
                <p style="margin:8px 0 0;font-size:13px;color:#78350f">
                    Zadejte API klíč z vašeho Zapi dashboardu pro aktivaci chatu.
                </p>
            </div>
            <?php endif; ?>

            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin-top:16px">
                <strong style="font-size:13px">Jak získat API klíč:</strong>
                <ol style="font-size:13px;margin:8px 0 0;padding-left:20px;line-height:1.8">
                    <li>Přihlaste se na <a href="https://app.zapi.cz/dashboard.html" target="_blank">app.zapi.cz</a></li>
                    <li>V sekci <strong>Přehled</strong> zkopírujte svůj API klíč</li>
                    <li>Vložte ho do pole výše a klikněte <strong>Uložit nastavení</strong></li>
                </ol>
            </div>
        </div>
    </div>
    <?php
}

// ── Inject widget script on frontend ─────────────────────────────────────────

add_action( 'wp_footer', function () {
    $api_key = get_option( ZAPI_OPTION_KEY, '' );
    if ( ! $api_key ) return;

    $widget_url = esc_url( ZAPI_WIDGET_URL );
    $api_key    = esc_attr( $api_key );

    echo "\n<!-- Zapi Widget v" . ZAPI_VERSION . " -->\n";
    echo "<script src=\"{$widget_url}\" data-api-key=\"{$api_key}\" async></script>\n";
} );

// ── Plugin action links ───────────────────────────────────────────────────────

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), function ( $links ) {
    $settings = '<a href="' . admin_url( 'options-general.php?page=zapi-widget' ) . '">Nastavení</a>';
    array_unshift( $links, $settings );
    return $links;
} );
