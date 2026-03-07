import jwt from 'jsonwebtoken';
// Middleware to authenticate JWT token from Authorization header or cookies
export const authenticateToken = (req, res, next) => {
   const authHeader = req.headers['authorization'];
   const bearerToken = authHeader?.split(' ')[1]; // Extract token from "Bearer <token>"
   const cookieToken = req.cookies?.accessToken; // Extract token from cookies
   const token = bearerToken || cookieToken; // Prioritize Bearer token over cookie token
   if(token == null) return res.status(401).json({ message: 'No token provided' });

   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      if(err) return res.status(403).json({ message: 'Invalid token' });
      req.user = user
      next();
   })
}
