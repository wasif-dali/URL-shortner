const express = require("express");
const urlcontroller = require("../controllers/urlController.js");
const router = express.Router();

router.post("/url/shorten", urlcontroller.shorturl);

router.get("/:urlCode", urlcontroller.geturl);

router.all("/*", function (req, res) {
  return res.status(404).send({ status: false, message: "Enter valid URL" });
});

module.exports = router;
