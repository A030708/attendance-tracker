// src/api/twoFactor.js
import express from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { supabase } from '../lib/supabase.js';

const router = express.Router();

// Generate 2FA secret for user
router.post('/generate-secret', async (req, res) => {
  try {
    const { userId, email } = req.body;
    
    const secret = speakeasy.generateSecret({
      name: `SchoolApp:${email}`,
      issuer: 'School Management System'
    });
    
    // Store temporary secret
    await supabase
      .from('profiles')
      .update({ two_factor_temp_secret: secret.base32 })
      .eq('id', userId);
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    res.json({
      secret: secret.base32,
      qrCodeUrl,
      otpauthUrl: secret.otpauth_url
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify TOTP token
router.post('/verify-token', async (req, res) => {
  try {
    const { userId, token } = req.body;
    
    // Get user's secret
    const { data: profile } = await supabase
      .from('profiles')
      .select('two_factor_temp_secret, two_factor_secret')
      .eq('id', userId)
      .single();
    
    const secret = profile.two_factor_temp_secret || profile.two_factor_secret;
    
    if (!secret) {
      return res.status(400).json({ error: 'No 2FA secret found' });
    }
    
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1
    });
    
    res.json({ verified });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enable 2FA
router.post('/enable', async (req, res) => {
  try {
    const { userId, secret } = req.body;
    
    // Generate backup codes
    const backupCodes = Array.from({ length: 10 }, () => 
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
    
    await supabase
      .from('profiles')
      .update({
        two_factor_enabled: true,
        two_factor_secret: secret,
        two_factor_backup_codes: backupCodes,
        two_factor_temp_secret: null
      })
      .eq('id', userId);
    
    res.json({ backupCodes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;