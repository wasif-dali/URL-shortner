const mongoose = require('mongoose')
const shortId = require('shortid')
const axios = require('axios')
// const validURL = require('valid-url')
const urlModel = require('../models/urlModel')
const redis = require('redis')
const { promisify } = require("util");

 

const redisClient = redis.createClient(
    11154,
    "redis-11154.c212.ap-south-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);

redisClient.auth("rgq6ulCgROhw5QwmYnbrkaXCzQU6jNhn", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient); 


const shorturl = async function (req, res) {
    try {
        if(Object.keys(req.body).length==0){
            return res.status(400).send({ status: false, message: "Invalid request:Please provide longUrl in the Body" })
        }
        let longUrl = req.body.longUrl
        if (!longUrl) {
            return res.status(400).send({ status: false, message: "Please provide longUrl" })
        }
        if (typeof longUrl !== "string") {
            return res.status(400).send({ status: false, message: "longUrl must be in String" })
        }
        longUrl = longUrl.trim()
        // if(!validURL.isUri(longUrl)){
        //     return res.status(400).send({ status: false, message: "Please provide valid longUrl(isUri)" })
        // }
        let gau = longUrl.startsWith("http://") || longUrl.startsWith("https://") || longUrl.startsWith("ftp://")
        if (!gau) {
            return res.status(400).send({ status: false, message: "Please provide valid LongUrl" })
        }
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        let catchedUrldata = await GET_ASYNC(`${longUrl}`)
        // console.log(catchedUrldata)
        if (catchedUrldata) {
            return res.status(200).send({ status: true, message: "ShortUrl is already created for this URL(REDIS)", data: JSON.parse(catchedUrldata) })
        }
        //+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++


        let url = await urlModel.findOne({ longUrl: longUrl }).select({ _id: 0, __v: 0 })
        if (url) {
            await SET_ASYNC(`${url.longUrl}`, JSON.stringify(url), 'EX', 10)//stringify converts objects into string
            return res.status(200).send({ status: true, message: "ShortUrl is already created for this URL", data: url })
        }
        //------------------------------------------------------->Axios--------------------------------------------------->
        let obj = {
            method: 'get',
            url: longUrl
        }
        let urlFound;
        await axios(obj).then(()=>urlFound=true).catch(() => { urlFound = false });
        if (!urlFound) {
            return res.status(400).send({ status: false, message: "Please provide valid LongUrl(Axios)" })
        }
        //------------------------------------------------------->Axios Over--------------------------------------------------->

        let urlCode = (shortId.generate()).toLowerCase();
        let baseUrl = "http://localhost:3000/"
        let shortUrl = baseUrl + urlCode;

        let savedData = await urlModel.create({ urlCode: urlCode, longUrl: longUrl, shortUrl: shortUrl })
        await SET_ASYNC(`${savedData.longUrl}`, JSON.stringify({ urlCode: savedData.urlCode, longUrl: savedData.longUrl, shortUrl: savedData.shortUrl }), 'EX', 10)//stringify converts objects into string

        return res.status(201).send({
            status: true, message: "ShortUrl Generated Successfully", data: {
                urlCode: savedData.urlCode,
                longUrl: savedData.longUrl,
                shortUrl: savedData.shortUrl
            }
        })
    }
    catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}

const geturl = async function (req, res) {
    try {
        if (!shortId.isValid(req.params.urlCode.trim())) {
            return res.status(400).send({ status: false, message: "Please provide valid urlCode" })
        }
        //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
        let catchedUrldata = await GET_ASYNC(`${req.params.urlCode.trim()}`)
        // console.log(catchedUrldata)
        if (catchedUrldata) {
            // console.log("I am in")
            return res.status(302).redirect(JSON.parse(catchedUrldata))
        }
        //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

        const url = await urlModel.findOne({ urlCode: req.params.urlCode.trim() })
        if (url) {
            // console.log('I am out')
            //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
            await SET_ASYNC(`${url.urlCode}`, JSON.stringify(url.longUrl), 'EX', 30)
            await SET_ASYNC(`${url.longUrl}`, JSON.stringify(url), 'EX', 30)
            //++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
            return res.status(302).redirect(url.longUrl)
        } else {
            return res.status(404).send({ status: false, message: "No documnet found with this urlCode" });
        }
    } catch (err) {
        return res.status(500).send({ status: false, message: err })
    }
}

module.exports = { shorturl, geturl }