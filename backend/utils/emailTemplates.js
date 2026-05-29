// Modern HTML Email Templates

const modernTemplate = (content, firstName = 'there') => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }
        .header h1 { color: white; font-size: 28px; font-weight: 600; margin-bottom: 10px; }
        .header p { color: rgba(255,255,255,0.9); font-size: 16px; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 20px; font-weight: 600; color: #2d3748; margin-bottom: 20px; }
        .message { font-size: 16px; line-height: 1.8; color: #4a5568; margin-bottom: 30px; }
        .cta { text-align: center; margin: 40px 0; }
        .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); }
        .footer { background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer p { color: #718096; font-size: 14px; margin-bottom: 10px; }
        .social { margin: 20px 0; }
        .social a { display: inline-block; margin: 0 10px; color: #667eea; text-decoration: none; }
        @media (max-width: 600px) {
            .container { width: 100% !important; }
            .header, .content, .footer { padding: 20px !important; }
            .header h1 { font-size: 24px !important; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Our Platform</h1>
            <p>We're excited to have you on board!</p>
        </div>
        <div class="content">
            <div class="greeting">Hi ${firstName}! 👋</div>
            <div class="message">
                ${content.replace(/\n/g, '<br>')}
            </div>
            <div class="cta">
                <a href="#" class="btn">Get Started</a>
            </div>
        </div>
        <div class="footer">
            <p>Thanks for joining us!</p>
            <p>Best regards,<br><strong>The Team</strong></p>
            <div class="social">
                <a href="#">Website</a> • <a href="#">Support</a> • <a href="#">Unsubscribe</a>
            </div>
        </div>
    </div>
</body>
</html>
`;

const businessTemplate = (content, firstName = 'there') => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; background: #ffffff; }
        .container { max-width: 600px; margin: 0 auto; border: 1px solid #e1e5e9; }
        .header { background: #2c3e50; color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: normal; }
        .content { padding: 40px 30px; background: white; }
        .greeting { font-size: 18px; color: #2c3e50; margin-bottom: 20px; font-weight: 600; }
        .message { color: #34495e; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
        .signature { margin-top: 40px; padding-top: 20px; border-top: 2px solid #ecf0f1; }
        .signature p { margin: 5px 0; color: #7f8c8d; }
        .footer { background: #ecf0f1; padding: 20px; text-align: center; font-size: 12px; color: #95a5a6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Professional Communication</h1>
        </div>
        <div class="content">
            <div class="greeting">Dear ${firstName},</div>
            <div class="message">
                ${content.replace(/\n/g, '<br><br>')}
            </div>
            <div class="signature">
                <p><strong>Best regards,</strong></p>
                <p><strong>Your Business Team</strong></p>
                <p>Email: contact@yourbusiness.com</p>
                <p>Phone: +1 (555) 123-4567</p>
            </div>
        </div>
        <div class="footer">
            <p>This email was sent from a professional business account.</p>
        </div>
    </div>
</body>
</html>
`;

const minimalistTemplate = (content, firstName = 'there') => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 40px; background: #fafafa; color: #333; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 60px 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .greeting { font-size: 24px; font-weight: 300; margin-bottom: 30px; color: #2c3e50; }
        .message { font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 40px; }
        .signature { font-size: 14px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
        a { color: #3498db; text-decoration: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="greeting">Hello ${firstName},</div>
        <div class="message">
            ${content.replace(/\n/g, '<br><br>')}
        </div>
        <div class="signature">
            <p>Warm regards,<br>The Team</p>
        </div>
    </div>
</body>
</html>
`;

module.exports = {
    modern: modernTemplate,
    business: businessTemplate,
    minimalist: minimalistTemplate
};