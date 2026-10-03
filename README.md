# gcgui

Desktop application built with **Electron** and **React** (via Vite) for a fast, modern UI experience.

---
## quickstart
### install 
#### method 1: prebuilt binary
1. go to releases
2. click on the relevant file for your OS (.exe for windows, etc)
3. install and run app
#### method 2: run from source 
1. download source files
2. install nodejs and npm
3. use "npm run dev"

### usage
1. select mode ("can" or "csv")
2. select port (hit refresh if it doesnt come up)
    > note that you must first close any software reading from that serial port (ie arduino ide serial monitor)
3. setup widgets 
    > there are example widget setups (stored as .json files) in assets/examples. Try pliq_template1.json
4. hit run to start recording!

### can vs csv
this app can read 2 different kinds of data from serial: 

crtd: 
```crtd
timestamp.timestamp cantype id data data data data
2172.562 R29 0000052C 00 00 FF FF FF FF FF FF
2172.606 R29 0000052C 00 00 FF FF FF FF FF FF
2172.652 R29 0000052C 00 00 FF FF FF FF FF FF
2172.692 R29 0000052C 00 00 FF FF FF FF FF FF
2172.742 R29 18FF01F4 B8 88 FE D4 00 00 01 FF
```

and csv

```csv
timestamp,datapt1,datapt2
0.00, -11.73, -10.20
0.11, -11.73, -11.73
0.22, -11.73, -10.20
0.32, -11.73, -11.73
0.42, -11.73, -11.73
0.52, -11.73, -11.73
0.62, -11.73, -11.73
```

<!-- ## Table of Contents

1. [Project Overview](#project-overview)
2. [Folder Structure](#folder-structure)
3. [Key Files](#key-files)
4. [Development Setup](#development-setup)
5. [Running the Project](#running-the-project)
6. [Production Build](#production-build)
7. [React Navigation](#react-navigation)
8. [Common Issues & Fixes](#common-issues--fixes)
9. [Tips & Tools for Documentation](#tips--tools-for-documentation) -->

---

## Project Overview

**Technologies Used:**

- **Electron:** Desktop application framework
- **React + Vite:** Frontend UI with fast hot-reloading
- **Node.js:** Runtime environment
- **Dev Tools:** `concurrently`, `wait-on` for managing startup order

**Purpose:**  
Wrap a React application into a native desktop app using Electron. Provides a modern UI with React and fast development workflow with Vite.

---

## widgets and their functions 

### number
shows a number for a given datapoint (csv and crtd)
### line plot 
shows a line plot for a given datapoint over time (csv and crtd)
### raw serial
shows raw serial input over time (csv and crtd)
### can interpreter (CAN)
shows a bunch of data parsed from CAN. Separates messages by id and performs adjustments to match to a given unit of measurement
### radio (currently CAN, plans to implement for csv as well)
a dedicated interpreter to show only radio status (ie status and signal strength)
### send 
a serial monitor that is able to write to serial (output through serial)
### key send
like send, but hits enter after each keypress (keymapping capabilities)

## Getting Started: Development

1. pnpm install
2. pnpm run dev
3. pnpm run lint (oxlint)

## publishing releases

based on [this guide](https://github.com/marketplace/actions/electron-builder-action), we are publishing versions to github. Follow these instructions, and actions should auto-build on our chosen OSs. MAKE SURE TO UPDATE THE VERSION NUMBER, or GITHUB RELEASES won't know wtf happened.

### release instructions

#### TL;DR

1. go into package.json
2. update version numbers, e.g. 1.2.3
3. git commit -am v1.2.3
4. git tag v1.2.3
5. git push origin v1.2.3

> the "v-" before the version number is super important, otherwise the thingy won't run.

## to build app as standalone

> this is unrecommended, as it is likely we will implement Github actions to auto-build this. However, if it is necessary, here are instructions to manually build on your machine.

1. pnpm install
2. pnpm run package

> note that pnpm occasionally is unable to build packages on running pnpm install. Check that your Node.js version matches `.github/workflows/build.yml`, then retry with a clean install (`rm -rf node_modules && pnpm install`).

> note that on windows, you need to enable developer settings. (settings -> system -> advanced -> developer mode)

---

## Folder Structure

.
├── electron
│ ├── main.js
│ └── preload.js
├── .oxlintrc.json
├── gui
├── index.html
├── package.json
├── pnpm-lock.yaml
├── public
│ └── logo.jpg
├── README.md
├── src
│ ├── App.css
│ ├── App.jsx
│ ├── assets
│ │ └── examples
│ │ ├── random_correct_messages
│ │ │ └── random_correct_messages.ino
│ │ ├── simple_pitwall.json
│ │ ├── simple_serial_test
│ │ │ ├── arduino_counterpart
│ │ │ │ └── arduino_counterpart.ino
│ │ │ └── var.jsx
│ │ └── test-config.json
│ ├── components
│ │ ├── BMS.css
│ │ ├── BMS.jsx
│ │ ├── ControlBar.jsx
│ │ ├── Editor.jsx
│ │ ├── Palette.jsx
│ │ ├── parsers
│ │ │ └── canproc.jsx
│ │ ├── RadioWidget.css
│ │ ├── RadioWidget.jsx
│ │ ├── RawSerialWidget.css
│ │ └── RawSerialWidget.jsx
│ ├── index.css
│ ├── main.jsx
│ ├── pages
│ │ └── Home.jsx
│ └── utils
│ ├── config.js
│ └── crtdParser.js
└── vite.config.js

---

Using HashRouter ensures navigation works properly in Electron without server configuration.
Common Issues & Fixes
Issue Cause Solution
require is not defined Project is in ES module mode ("type": "module") Rename Electron files to .cjs or remove "type": "module" from package.json
ERR_CONNECTION_REFUSED Dev server not running Ensure Vite starts, check port 5173, or increase wait-on timeout
Electron opens empty window
