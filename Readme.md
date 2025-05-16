# HID DigitalPersona Integrated Windoows Authentication (IWA) API

This JavaScript library allows to use Integrated Windoows Authentication (IWA)
in web browsers using a DigitalPersona local device access API.

> [!IMPORTANT]
> The API is designed to be used in a browser environment only!
This is not a NodeJS library!

## Requirements

The IWA API requires one of following HID DigitalPersona clients to be installed
on the user's machine:

* [HID DigitalPersona Workstation / Kiosk](https://www.hidglobal.com/product-mix/digitalpersona) -- part of HID DigitalPersona Premium suite, providing multi-factor authentication, biometrics, integration with Active Directory, etc.
* [HID Authentication Device Client ](https://digitalpersona.hidglobal.com/lite-client/) (previously "Lite Client") -- a free Windows client, providing 
communication with devices like fingerprint readers, cards etc.

## Target platforms and technologies

Supported platforms:

* Windows 10 and later
* Windows Server 2008 R2 and later

Supported browsers:

* Chrome and Chrome-based browsers (Edge etc)
* Firefox
* Edge Legacy (WebView2)

Module formats (browser-only, no NodeJS!):

* IIFE (ES5): `dist/fingerprint.sdk[.min].js`
* Typings (TypeScript): `dist/fingerprint.sdk.d.ts

## Documentation

[Usage information and API description](./docs/usage/index.adoc)

[Code samples](samples)

[Information for contributors/maintainers](./docs/maintain/index.adoc)

## License

The library is licensed under the [MIT](./LICENSE) license.

Copyright (c) 2025 HID Global, Inc.

