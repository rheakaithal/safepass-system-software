# Safepass App Testing Guide 🧪

Welcome! Testing the live SafePass mobile architecture is designed to be completely frictionless. You don't need to manually configure any brokers or touch any backend code. 

Everything boots up from one single command.

## Step 1: Boot the Live Environment
From the `/components` directory, simply run:
```bash
npm run demo-mobile
```
*(This automatically boots the backend message subscriber, spins up the mobile Expo server, and turns on the continuous data tester.)*

## Step 2: Open the Mobile App
Open the **Expo Go** app on your iPhone and scan the massive QR code that pops up in the terminal. You should immediately see the native interface populate with active flood warnings!

## Step 3: Control the Water Levels (Interactive Mode)
If you want to manually test the React Native UI switching between `CRITICAL`, `WARNING`, and `SAFE` states without touching any code, kill your terminal and run the interactive CLI!

Open two tabs:
**Tab 1:** `npm run demo-mobile`
**Tab 2:** 
```bash
cd backend
node interactiveTest.js
```
The interactive terminal will directly ask you to type in water level numbers. The second you hit "Enter" on a number like `85`, look at your phone instantly trigger a Critical alert!
