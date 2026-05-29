# MERN Email Outreach & Marketing Automation Platform

A full-featured email outreach and marketing automation platform built with the MERN stack (MongoDB, Express, React, Node.js).

## 🚀 Features

### Core Features
- **Multi-Provider Email Support**: Gmail, G Suite, Outlook, Office365, Yahoo, Custom SMTP
- **One-Time Setup**: Store encrypted mailbox credentials and DNS settings once, use everywhere
- **Multi-Step Email Sequences**: Create automated follow-up sequences with delays and conditions
- **Advanced Tracking**: Open tracking, click tracking, reply detection via IMAP
- **Contact Management**: CSV upload, deduplication, status management
- **Analytics Dashboard**: Detailed performance metrics and campaign analytics
- **DNS Configuration**: SPF, DKIM, DMARC, and tracking domain setup

### Security Features
- **Encrypted Credentials**: AES-256 encryption for email passwords
- **JWT Authentication**: Secure user authentication
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive data validation

### Automation Features
- **IMAP Reply Detection**: Automatically stop sequences when replies are received
- **Throttling**: Per-mailbox sending limits (hourly/daily)
- **Scheduled Sending**: Background workers for sequence processing
- **Campaign Management**: Start, pause, resume campaigns

## 📦 Tech Stack

### Backend
- **Node.js** + **Express.js** - Server framework
- **MongoDB** + **Mongoose** - Database
- **Nodemailer** - Email sending
- **IMAP-Simple** - Reply detection
- **Node-Cron** - Scheduled tasks
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Crypto** - Credential encryption

### Frontend
- **React 18** - UI framework
- **React Router** - Navigation
- **React Query** - Data fetching
- **React Hook Form** - Form handling
- **Tailwind CSS** - Styling
- **Recharts** - Analytics charts
- **Lucide React** - Icons

## 🛠 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Redis (for background jobs)

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/email-outreach
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ENCRYPTION_KEY=your-32-character-encryption-key-here
   REDIS_URL=redis://localhost:6379
   TRACKING_DOMAIN=track.yourdomain.com
   BASE_URL=http://localhost:5000
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📋 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Mailbox Endpoints
- `GET /api/mailbox` - Get all mailboxes
- `POST /api/mailbox` - Add new mailbox
- `POST /api/mailbox/:id/verify` - Verify mailbox
- `DELETE /api/mailbox/:id` - Delete mailbox

### Contact Endpoints
- `GET /api/contact` - Get contacts (with pagination)
- `POST /api/contact` - Add single contact
- `POST /api/contact/upload` - Upload CSV
- `PUT /api/contact/:id` - Update contact
- `DELETE /api/contact/:id` - Delete contact

### Campaign Endpoints
- `GET /api/campaign` - Get all campaigns
- `POST /api/campaign` - Create campaign
- `GET /api/campaign/:id` - Get campaign details
- `POST /api/campaign/:id/start` - Start campaign
- `POST /api/campaign/:id/pause` - Pause campaign
- `DELETE /api/campaign/:id` - Delete campaign

### DNS Endpoints
- `GET /api/dns` - Get DNS settings
- `POST /api/dns` - Save DNS settings
- `POST /api/dns/generate` - Generate DNS records
- `POST /api/dns/:id/verify` - Verify DNS settings

### Analytics Endpoints
- `GET /api/analytics/dashboard` - Dashboard analytics
- `GET /api/analytics/campaign/:id` - Campaign analytics

### Tracking Endpoints
- `GET /api/tracking/open/:logId` - Open tracking pixel
- `GET /api/tracking/click/:logId` - Click tracking redirect
- `GET /api/tracking/unsubscribe/:contactId` - Unsubscribe

## 🔧 Configuration

### Email Provider Settings
The platform automatically configures SMTP/IMAP settings for popular providers:

- **Gmail/G Suite**: smtp.gmail.com:587, imap.gmail.com:993
- **Outlook**: smtp-mail.outlook.com:587, outlook.office365.com:993
- **Office365**: smtp.office365.com:587, outlook.office365.com:993
- **Yahoo**: smtp.mail.yahoo.com:587, imap.mail.yahoo.com:993

### DNS Configuration
For proper email delivery, configure these DNS records:

1. **SPF Record** (TXT): `v=spf1 include:_spf.google.com include:spf.protection.outlook.com ~all`
2. **DKIM Record** (TXT): Generated automatically
3. **DMARC Record** (TXT): `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com`
4. **Tracking Domain** (CNAME): Points to your server

## 🚦 Usage

### 1. Setup Mailboxes
1. Go to **Mailboxes** page
2. Click **Add Mailbox**
3. Select provider and enter credentials
4. Verify the mailbox

### 2. Configure DNS
1. Go to **DNS Settings** page
2. Add your domain
3. Generate DNS records
4. Add records to your DNS provider
5. Verify configuration

### 3. Import Contacts
1. Go to **Contacts** page
2. Upload CSV file or add manually
3. System automatically deduplicates

### 4. Create Campaigns
1. Go to **Campaigns** page
2. Click **Create Campaign**
3. Select mailbox and contacts
4. Build email sequence
5. Start campaign

### 5. Monitor Performance
1. Check **Dashboard** for overview
2. Use **Analytics** for detailed metrics
3. Monitor individual campaign performance

## 🔒 Security Best Practices

1. **Use App Passwords**: For Gmail/Outlook, use app-specific passwords
2. **Secure Environment**: Keep `.env` file secure and never commit it
3. **Regular Updates**: Keep dependencies updated
4. **Rate Limiting**: Configure appropriate sending limits
5. **DNS Security**: Properly configure SPF, DKIM, and DMARC

## 🐛 Troubleshooting

### Common Issues

1. **Email Not Sending**
   - Verify mailbox credentials
   - Check SMTP settings
   - Ensure app passwords are used

2. **Tracking Not Working**
   - Verify tracking domain DNS
   - Check BASE_URL configuration
   - Ensure tracking is enabled

3. **Reply Detection Issues**
   - Verify IMAP settings
   - Check IMAP worker is running
   - Ensure proper message threading

## 📈 Performance Optimization

1. **Database Indexing**: Indexes are automatically created
2. **Connection Pooling**: MongoDB connection pooling enabled
3. **Caching**: Implement Redis caching for frequently accessed data
4. **Background Jobs**: Use Bull queues for heavy operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the troubleshooting section

---

**Built with ❤️ using the MERN stack**