const jwt = require('jsonwebtoken');
//provide jwt function
const provideToken = (userPayload) => {
  return jwt.sign(
    { userid: userPayload.userid, email: userPayload.email }, 
    process.env.JWT_SECRET, 
    { expiresIn: '1h' }
  );
};
// check jwt function
const checkToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { valid: true, data: decoded };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};
//export module
module.exports = {
  provideToken,
  checkToken
};