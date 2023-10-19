// Import necessary modules and packages
const Token = require('./models/tokenModel'); // Import the Token model for working with tokens
const jwt = require("jsonwebtoken"); // Import the JSON Web Token (JWT) package
const catchAsync = require("./utils/catchAsync"); // Import the catchAsync utility function
// Function to generate a JWT token for a user and set it in a cookie
const generatejwt = async (user, res) => {
    // Extract user information like _id and email
    const { _id, email, username } = user;

    // Create a JWT token with user data and a secret key, set to expire in 2 hours
    const token = jwt.sign(
        { user_id: _id, email, username },
        process.env.TOKEN_KEY, // Use the TOKEN_KEY from environment variables as the secret key
        {
            expiresIn: "2h", // Token expires in 2 hours
        }
    );

    // Set the token in a cookie named "token"
    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' });

    // Create a new Token record in the database to keep track of tokens
    const tokenRecord = new Token({ token });

    // Save the token record to the database
    await tokenRecord.save();

    // Log the generated token for debugging (remove in production)
    console.log(token);
}

// Function to clear the "token" cookie on the client side
const clearTokenCookie = (res) => {
    res.clearCookie("token");
};

// Function to log out the user by clearing the token on both client and server sides
const logout = async (req, res) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(200).json({ message: "Logged out successfully" });
        }

        // Delete the token from the database (if it exists)
        await Token.findOneAndDelete({ token });

        // Clear the token cookie on the client side
        clearTokenCookie(res);

        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const verifyToken = catchAsync(async (req, res, next) => {
    const bearer = req.cookies.token;

    if (!bearer) return res.status(401).json({ message: "You are not Authenticated" });

    try {
        const authData = jwt.verify(bearer, process.env.TOKEN_KEY);

        return res.status(200).json({
            status: "success",
            data: { authData },
        });

    } catch (error) {
        return res.status(401).json({
            status: "failure",
            data: { error },
        });
    }
});

// Middleware function to verify the JWT token from a cookie and authenticate the user
const verifyjwt = async (req, res, next) => {
    try {
        // Extract the JWT token from the "token" cookie
        const token = req.cookies.token;

        // If no token is found, return an Unauthorized response (HTTP 401)
        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // Verify the token using the secret key (TOKEN_KEY) from environment variables
        const decoded = jwt.verify(token, process.env.TOKEN_KEY);

        // Check if the token exists in the database (previously generated by generatejwt)
        const tokenRecord = await Token.findOne({ token });

        // If the token does not exist in the database, return Unauthorized
        if (!tokenRecord) {
            return res.status(401).json({ message: "You are not Loggedin please Login" });
        }

        // Attach the decoded user data to the request object for further use
        req.user = decoded;

        // Continue to the next middleware or route
        next();
    } catch {
        return res.status(401).json({ message: "Unauthorized" });
    }
};

// Export the generatejwt and verifyjwt functions for use in other parts of the application
module.exports = { generatejwt, verifyjwt, logout, verifyToken };
