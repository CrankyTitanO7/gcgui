# BDR-Pitwall

Desktop application built with **Electron** and **React** (via Vite) for a fast, modern UI experience.

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Folder Structure](#folder-structure)
3. [Key Files](#key-files)
4. [Development Setup](#development-setup)
5. [Running the Project](#running-the-project)
6. [Production Build](#production-build)
7. [React Navigation](#react-navigation)
8. [Common Issues & Fixes](#common-issues--fixes)
9. [Tips & Tools for Documentation](#tips--tools-for-documentation)

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

## Getting Started 

1. cd bdr-pitwall
2. cd src
3. npm install
4. npm run start/npm run dev

---

## Folder Structure

bdr-pitwall/
├── electron/
│ ├── main.cjs # Electron main process entry
│ └── preload.cjs # Optional preload script
├── src/
│ ├── main.jsx # React entry point
│ ├── App.jsx
│ ├── index.html
│ └── pages/
│ ├── Home.jsx
│ └── About.jsx
├── dist/ # Production build output (after npm run build)
├── package.json
├── vite.config.js
└── node_modules/

---


Using HashRouter ensures navigation works properly in Electron without server configuration.
Common Issues & Fixes
Issue	Cause	Solution
require is not defined	Project is in ES module mode ("type": "module")	Rename Electron files to .cjs or remove "type": "module" from package.json
ERR_CONNECTION_REFUSED	Dev server not running	Ensure Vite starts, check port 5173, or increase wait-on timeout
Electron opens empty window