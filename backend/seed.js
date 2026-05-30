require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const User = require('./models/User');

async function seedUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    const email = 'sahil@example.com';
    const existing = await User.findOne({ email });

    if (existing) {
      console.log(`User ${email} already exists.`);
    } else {
      const user = new User({
        email,
        password: 'password123',
        firstName: 'Sahil',
        lastName: 'Developer',
        company: 'Freelancer'
      });
      await user.save();
      console.log(`User ${email} created successfully! ID: ${user._id}`);
    }
  } catch (err) {
    console.error('Error seeding user:', err);
  } finally {
    await mongoose.disconnect();
  }
}

seedUser();
