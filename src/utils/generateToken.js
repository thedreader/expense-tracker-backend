import jwt from 'jsonwebtoken';

function generateAccessToken(user) {
   return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
}

function generateRefreshToken(user) {
   return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

export { generateAccessToken, generateRefreshToken };