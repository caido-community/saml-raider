<div align="center">
  <img width="1000" alt="image" src="assets/banner.png">

  <br />
  <br />
  <a href="https://github.com/caido-community" target="_blank">Github</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://developer.caido.io/" target="_blank">Documentation</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://links.caido.io/www-discord" target="_blank">Discord</a>
  <br />
  <hr />
</div>

# SAML Raider

SAML Raider decodes SAML messages carried in HTTP traffic and gives you a `SAML` view mode next to Raw and Pretty in HTTP History, Replay, Intercept, Search, Sitemap, Automate and Findings.

It has three tabs: the decoded **message**, the parsed **message info**, and **attacks**. From the attacks tab you can wrap signatures (XSW1 to XSW8), re-sign an assertion or a message with a certificate you control, remove signatures, match and replace, insert XXE and XSLT payloads, and apply presets shaped after published SAML CVEs. Every change is previewed as a diff and only written into the request when you apply it.

It also manages the certificates used for re-signing: import, generate self signed, clone an identity provider's certificate, and export or restore the whole store.

## 🚀 Getting Started

### Installation [Recommended]

1. Open Caido, navigate to the `Plugins` sidebar page and then to the `Community Store` tab
2. Find `SAML Raider` and click Install
3. Done! 🎉

### Installation [Manual]

1. Go to the [SAML Raider Releases tab](https://github.com/caido-community/saml-raider/releases) and download the latest `plugin_package.zip` file
2. In your Caido instance, navigate to the `Plugins` page, click `Install` and select the downloaded `plugin_package.zip` file
3. Done! 🎉

## Using it

Open any request carrying a SAML message and pick the `SAML` view mode.

- **SAML Message** shows the decoded XML, raw or prettified.
- **SAML Message Info** shows issuer, subject, conditions, signed elements and any embedded certificates, which you can send to the certificate manager.
- **SAML Attacks** runs the transformations. Pick one, press Preview, read the diff, then Apply to request.

Attacks are only available where Caido lets a plugin write, which means Replay and Intercept. In HTTP History the tab is read only. Press `Ctrl+R` to send the request to Replay first.

Enable **Settings → Highlight SAML traffic** to colour SAML requests in the proxy history.

## 💚 Community

Join our [Discord](https://links.caido.io/www-discord) community and connect with other Caido users! Share your ideas, ask questions, and get involved in discussions around Caido and security testing.

## 🤝 Contributing

Feel free to contribute! If you'd like to request a feature or report a bug, please create a [GitHub Issue](https://github.com/caido-community/saml-raider/issues/new).
