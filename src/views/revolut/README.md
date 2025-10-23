# Revolut Payment Views

This folder contains HTML templates for handling Revolut payment redirects and status pages.

## Files

### 1. `payment-success.html`
Displays when payment is completed successfully.

**URL Parameters:**
- `paymentId` - The payment transaction ID
- `amount` - Payment amount
- `currency` - Currency code (default: GBP)

**Usage:**
```
http://your-domain.com/views/revolut/payment-success.html?paymentId=123&amount=25.50&currency=GBP
```

**Features:**
- Success animation with checkmark
- Payment details display
- Auto-redirect to app via deep link
- Mobile-responsive design

---

### 2. `payment-failed.html`
Displays when payment fails or is cancelled.

**URL Parameters:**
- `paymentId` - The payment transaction ID
- `amount` - Payment amount
- `currency` - Currency code (default: GBP)
- `error` - Error message to display

**Usage:**
```
http://your-domain.com/views/revolut/payment-failed.html?paymentId=123&amount=25.50&error=Payment declined
```

**Features:**
- Error animation with X icon
- Error reason display
- Retry payment button
- Go back button
- Support contact link
- Mobile-responsive design

---

### 3. `payment-processing.html`
Displays while payment is being verified.

**URL Parameters:**
- `paymentId` - The payment transaction ID to check status

**Usage:**
```
http://your-domain.com/views/revolut/payment-processing.html?paymentId=123
```

**Features:**
- Loading animation
- Progress bar
- Step-by-step status indicators
- Auto-checks payment status every 2 seconds
- Auto-redirects on completion/failure
- Timeout handling (60 seconds max)
- Mobile-responsive design

---

## Integration with Backend

### Setting up Express to serve these views

Add to your `backend/src/index.ts`:

```typescript
import path from 'path';
import express from 'express';

// Serve static files from views folder
app.use('/views', express.static(path.join(__dirname, 'views')));

// Optional: Create convenience routes
app.get('/payment/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/revolut/payment-success.html'));
});

app.get('/payment/failed', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/revolut/payment-failed.html'));
});

app.get('/payment/processing', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/revolut/payment-processing.html'));
});
```

---

## Revolut Redirect URLs

When creating a Revolut order, set these redirect URLs:

```typescript
const revolutResponse = await axios.post(
  `${REVOLUT_API_URL}/orders`,
  {
    amount: Math.round(amount * 100),
    currency: currency,
    // ... other fields
    redirect_urls: {
      success: `${YOUR_BACKEND_URL}/views/revolut/payment-success.html?paymentId=${paymentId}&amount=${amount}&currency=${currency}`,
      failure: `${YOUR_BACKEND_URL}/views/revolut/payment-failed.html?paymentId=${paymentId}&amount=${amount}`,
      cancel: `${YOUR_BACKEND_URL}/views/revolut/payment-failed.html?paymentId=${paymentId}&amount=${amount}&error=Payment cancelled`
    }
  }
);
```

---

## Deep Links Configuration

These pages use deep links to redirect back to your mobile app:

**Success:**
```javascript
dunfermlinetaxi://payment/success?paymentId=123
```

**Retry:**
```javascript
dunfermlinetaxi://payment/retry?paymentId=123
```

**Cancel:**
```javascript
dunfermlinetaxi://payment/cancel
```

### Setting up Deep Links in React Native

#### iOS (Info.plist)
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>dunfermlinetaxi</string>
    </array>
  </dict>
</array>
```

#### Android (AndroidManifest.xml)
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="dunfermlinetaxi" />
</intent-filter>
```

#### React Native Linking
```typescript
import { Linking } from 'react-native';

// Listen for deep links
useEffect(() => {
  const handleDeepLink = (event: { url: string }) => {
    const { url } = event;

    if (url.includes('payment/success')) {
      // Handle success
      const paymentId = url.split('paymentId=')[1];
      navigation.navigate('RideDetails', { rideId, paymentId });
    } else if (url.includes('payment/retry')) {
      // Handle retry
      navigation.navigate('PaymentWebView', { paymentUrl, paymentId });
    } else if (url.includes('payment/cancel')) {
      // Handle cancel
      navigation.goBack();
    }
  };

  Linking.addEventListener('url', handleDeepLink);

  return () => {
    Linking.removeEventListener('url', handleDeepLink);
  };
}, []);
```

---

## Customization

### Colors
The default color scheme uses:
- Primary: `#667eea` (Purple)
- Success: `#10b981` (Green)
- Error: `#ef4444` (Red)
- Warning: `#f59e0b` (Orange)

To customize, modify the CSS variables in each HTML file.

### Branding
Update the logo section in each file:
```html
<div class="logo">🚕 Dunfermline Taxi</div>
```

Replace with your logo image:
```html
<div class="logo">
  <img src="/path/to/logo.png" alt="Dunfermline Taxi" />
</div>
```

### Auto-redirect Timing
In `payment-success.html`, change the redirect delay:
```javascript
setTimeout(() => {
  window.location.href = 'dunfermlinetaxi://payment/success?paymentId=' + paymentId;
}, 3000); // Change 3000 to desired milliseconds
```

---

## Security Considerations

1. **HTTPS Only**: Always serve these pages over HTTPS in production
2. **Input Validation**: The pages use URL parameters - sanitize on backend
3. **CORS**: Configure CORS properly to prevent unauthorized access
4. **Deep Link Security**: Validate payment status in the app before showing success

---

## Testing

### Local Testing

1. Start your backend server:
   ```bash
   npm run dev
   ```

2. Open in browser:
   ```
   http://localhost:5001/views/revolut/payment-success.html?paymentId=test123&amount=25.50
   http://localhost:5001/views/revolut/payment-failed.html?paymentId=test123&amount=25.50&error=Test error
   http://localhost:5001/views/revolut/payment-processing.html?paymentId=test123
   ```

### Testing Deep Links

Use a tool like [Universal Links Validator](https://branch.io/resources/universal-links/) or test on a real device.

For iOS Simulator:
```bash
xcrun simctl openurl booted "dunfermlinetaxi://payment/success?paymentId=test123"
```

For Android Emulator:
```bash
adb shell am start -W -a android.intent.action.VIEW -d "dunfermlinetaxi://payment/success?paymentId=test123"
```

---

## Troubleshooting

### Pages not loading
- Check Express static file serving is configured
- Verify file paths are correct
- Check server logs for errors

### Deep links not working
- Verify URL scheme is registered in iOS/Android
- Check Linking listener is set up in React Native
- Test with simple deep link first

### Payment status not updating
- Check backend API endpoint `/api/payment/verify/:paymentId` is working
- Verify CORS allows requests from HTML pages
- Check browser console for errors

---

## Future Enhancements

- [ ] Add loading states with skeleton screens
- [ ] Implement retry mechanism with exponential backoff
- [ ] Add support for multiple languages
- [ ] Include payment receipt generation
- [ ] Add social sharing for successful bookings
- [ ] Implement analytics tracking

---

**Last Updated**: 2025-10-20
