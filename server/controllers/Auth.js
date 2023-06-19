const User = require("../models/User");
const OTP = require("../models/OTP");
const otpGenerator = require("otp-generator");
const { response } = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const nodemailer = require("nodemailer");

//OTP sender
exports.sendOTP = async (req, res) => {
  try {
    // fetching email from the request body
    const { email } = req.body;

    const checkUserPresent = await User.findOne({ email });
    if (checkUserPresent) {
      return res.status(401).json({
        success: false,
        message: "User already registered",
      });
    }

    //generate OTP  --> generates 6 digit otp with numerical value only
    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    console.log("OTP generated: ", otp);

    //check unique otp or not
    const result = await OTP.findOne({ otp: otp });

    // check till we got the unique OTP in DB.
    while (result) {
      otp = otpGenerator(6, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });
    }

    // Storing this OTP in our DataBase.
    const otpPayload = { email, otp };

    // create an entry in DB for OTp
    const otpBody = await OTP.create(optPayload);
    console.log(otpBody);

    res.status(200).json({
      success: true,
      message: "OTP send Successfully",
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

//signup
exports.signUp = async (req, res) => {
  try {
    // data fetch
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      accountType,
      contactNumber,
      otp,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !confirmPassword ||
      !otp
    ) {
      return res.status(401).json({
        success: false,
        message: "Fill the required Details",
      });
    }

    if (password !== confirmPassword) {
      return res.status(401).json({
        success: false,
        message: "Password doesn't match",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(401).json({
        success: false,
        message: "User Already Registered",
      });
    }

    // find most recent OTP from the Database so that we can match the otp from the User's OTP
    const recentOtp = await OTP.find({ email })
      .sort({ createdAt: -1 })
      .limit(1);

    //validate OTP from the User's OTP

    if (recentOtp.length == 0) {
      // OTP not found
      return response.status(400).json({
        success: false,
        message: "OTP not Found",
      });
    } else if (otp !== recentOtp.otp) {
      //Invalid OTP
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    //Now Hash the Password
    const hashedPassword = await bcrypt.hash(password, 10);

    const profileDetails = await Profile.create({
      gender: null,
      dateOfBirth: null,
      contactNumber: null,
      about: null,
    });

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      accountType,
      additionalDetails: profileDetails._id,
      image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
    });

    return res.status(200).json({
      success: true,
      message: "User Successfully Registered",
      user,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Please Try Again...",
    });
  }
};

// login Algorithm

// get data from req body
// validation data
// user check exist or not
// generate JWT, after Password Matching
// create cookie and send response

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(403).json({
        success: false,
        message: "Fill the required details",
      });
    }

    //email validation
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not exists",
      });
    }

    if (await bcrypt.compare(password, user.password)) {
      const payload = {
        email: user.email,
        id: user._id,
        role: user.role,
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "2h",
      });

      user.token = token;
      user.password = undefined;

      const options = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      };

      res.cookie("token", token, options).status(200).json({
        success: true,
        token,
        user,
        message: "Logged in Successfully",
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Incorrect Password",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login Failure Please Try Again",
    });
  }
};

//Change Password Algorithm
    // get data from req.body
    // get oldPassword, newPassword, confirmNewPassword
    // validation
    // hash the password
    // update password in DB
    // send mail - password updated
    // return response
exports.changePassword = async (req, res) => {
  const { email, currPassword, newPassword, confirmNewPassword } = req.body;

  if (!currPassword || !newPassword || !confirmNewPassword || !email) {
    return res.status(401).json({
      success: false,
      messsage: "Fill the required details",
    });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(401).json({
      success: false,
      message: "Password is not matching! Please try Again",
    });
  }

  const user = await User.findOne({ email });
  if(user)
  if (await bcrypt.compare(currPassword, user.password)) {

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const response = await User.findOneAndUpdate({ password: hashedPassword });

    if (response) {
      //transporter
      let transporter = nodemailer.createTransport({
        host: process.env.MAIL_HOST,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      //sending mail
      let info = await transporter.sendMail({
        from: `<H1>StudyMotion</H1>`,
        to: email,
        html: `<h2>Congratulations, Your password has Updated.</h2>`,
      });
      console.log("INFO", info);
      console.log("Mail Send Successfully!");

      return res.status(200).json({
        success : true,
        message : "Password is Successfully Updated"
      })
    } else {
      return res.status(500).json({
        success: false,
        message: "Try Again...",
      });
    }
  }
  else
  {
      return res.status(401).json({
        success : false,
        message : "Your old password doesn't match"
      })
  }
};