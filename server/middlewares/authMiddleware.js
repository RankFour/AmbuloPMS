import jwt from "jsonwebtoken";

const protect = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  const isApi = req.originalUrl.startsWith('/api/');
  if (!token) {
    if (isApi) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }
    return res.redirect('/login.html');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (isApi) {
      if (!['ADMIN', 'TENANT', 'MANAGER'].includes(decoded.role)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient role' });
      }
    } else {
      
      
    }
    req.user = decoded;
    next();
  } catch {
    if (isApi) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
    return res.redirect('/login.html');
  }
};


export { 
    protect
};