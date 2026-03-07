import User from "../models/User.js";
import bcrypt from 'bcryptjs';

export const getUser = async (req, res) => {
   try {
      const userId= req.user.id;
      const user = await User.findById(userId).select('-password');
      if(!user) {
         return res.status(404).json({ message: 'User not found' });
      }

      res.status(200).json(user);
   }
   catch (err) {
      console.error('Error fetching user: ', err);
      res.status(500).json({ message: 'Error fetching user' });
   }
}

export const updateUser = async (req, res) => {
   try {
      const userId= req.user.id;
      const { name, email, password } = req.body;
      const user = await User.findById(userId);
      if(!user) {
         return res.status(404).json({ message: 'User not found' });
      }

      if(name) user.name = name;
      if (email && email !== user.email) {
         const existingUser = await User.findOne({ email });
         if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
         }
         user.email = email;
      }
      if(password) {
         const salt = await bcrypt.genSalt(10);
         const hash = await bcrypt.hash(password, salt);
         user.password = hash;
      }

      await user.save();

      res.status(200).json({ message: 'User updated successfully' });
   }catch (err) {
      console.error('Error updating user: ', err);
      res.status(500).json({ message: 'Error updating user' });
   }
}