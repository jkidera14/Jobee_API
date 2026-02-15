const Job = require('../models/jobs');

const geoCoder = require('../utils/geocoder');
const ErrorHandler = require('../utils/errorHandler');
const catchAsyncErrors = require('../middlewares/catchAsyncErrors');
const APIFilters = require('../utils/apiFilters');
const path = require('path');
const fs = require('fs');


// Get all Jobs => / api/v1/jobs
exports.getJobs = catchAsyncErrors( async(req, res, next)=>{

    const apiFilters = new APIFilters(Job.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .searchByQuery()
    .pagination();

    const jobs = await apiFilters.query;
    res.status(200).json({
        success: true,
        results : jobs.length,
        data : jobs
    });
});
// Create a new Job  => /api/v1/job/new
exports.newJob = catchAsyncErrors ( async (req, res, next) =>{
    //Adding User to body
    req.body.user = req.user.id;

    const job = await Job.create(req.body);

    res.status(200).json({
        success : true,
        message : 'Job Created',
        data : job
    });
});

// Get a single job with id and slug => /api/v1/job/:id/:slug
exports.getJob = catchAsyncErrors( async (req, res, next) => {

    const job = await Job.find({$and : [{_id : req.params.id},{slug : req.params.slug}]}).populate({
        path : 'user',
        select : 'name'
    });

    if(!job || job.length === 0){
        return next(new ErrorHandler('Job not found', 404));
    }
    res.status(200).json({
        success : true,
        data : job
    });
});
// Update a Job => /api/v1/job/:id
exports.updateJob = catchAsyncErrors( async (req, res, next)=> {
    let job = await Job.findById(req.params.id);
    
    if(!job){

             return next(new ErrorHandler('Job not found', 404));

    }

    // Check If the User is the rightful Owner
    if(job.user.toString() !== req.user.id && req.user.role !== 'admin'){
        return next(new ErrorHandler(`User(${req.user.id}) is Not Permitted to Update this Job.`))
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
        new : true,
        runValidators : true,
        useFindAndModify: false
    });
    res.status(200).json({
        success : true,
        message : 'Job is Updated Successfully!',
        data : job
    });
});

// Delete a Job => /api/v1/job/:id
exports.deleteJob = catchAsyncErrors( async (req, res, next) =>{
    let job = await Job.findById(req.params.id).select('+applicantsApplied');

    if(!job) {
       return next(new ErrorHandler('Job not found', 404));
    }

     // Check If the User is the rightful Owner
    if(job.user.toString() !== req.user.id && req.user.role !== 'admin'){
        return next(new ErrorHandler(`User(${req.user.id}) is Not Permitted to Delete this Job.`))
    }

    // Deleting Files Associated with Job

     for(let i = 0; i<job.applicantsApplied.length; i++){
         let filepath = `${_dirname}/public/uploads/${job.applicantsApplied[i].resume}`.replace('\\controllers', ' ');
        
                    fs.unlink(filepath, err => {
                        if(err) return console.log(err);
                    });
        
    }

    job = await Job.findByIdAndDelete(req.params.id);

    res.status(200).json({
        success :   true,
        message : 'Job is Deleted Successfully!'
    });
});

// Search Jobs with radius => /api/v1/jobs/:zipcode/:distance
exports.getJobsInRadius = catchAsyncErrors( async (req, res, next) => {
    const { zipcode, distance } = req.params;

    // Getting latitude and longitude from geoCoder with zipcode
    const loc = await geoCoder.geocode(zipcode);
    const latitude = loc[0].latitude;
    const longitude = loc[0].longitude;

    const radius = distance / 3963;

    const jobs = await Job.find({
        location : {$geoWithin: {$centerSphere : [[longitude, latitude], radius ]

        }}
    })
    res.status(200).json({
        success: true,
        results : jobs.length,
        data : jobs
    });
});

// Get stats about a topic(job) => /api/v1/stats/:topic
exports.jobStats = catchAsyncErrors( async (req, res, next) =>{
    const stats = await Job.aggregate([
        {
            $match : {$text : {$search : "\""+req.params.topic +"\""}}
        },
        {
            $group : {
                _id : {$toUpper : '$experience'},
                totalJobs : {$sum : 1},
                avgPosition : {$avg : '$positions'},
                avgSalary : {$avg : '$salary'},
                minSalary : {$min : '$salary'},
                maxSalary : {$max : 'salary'}
            }
        }
    ]);

    if(stats.length === 0) {
        return next(new ErrorHandler(`No stats found for - ${req.params.topic}`, 200));
    }

    res.status(200).json({
        success : true,
        data : stats
    });
});

// Apply to Job using Resume => /api/v1/job/:id/apply
exports.applyJob = catchAsyncErrors( async(req, res, next) =>{
    let job = await Job.findById(req.params.id).select('+applicantsApplied');

    if(!job){
        return next(new ErrorHandler('Job Not Found.', 404));
    }


    // Check that if job last date has been passed or not
    if(job.lastDate < new Date(Date.now())){
        return next(new ErrorHandler('You cannot apply to this job. Date is over.', 404));
    }

    // Check If the User has applied before
    for( let i =0; i<job.applicantsApplied.length; i++){
        if(job.applicantsApplied[i].id === req.user.id){
            return next(new ErrorHandler('You have Already Applied to this Job.', 400));
        }

    }

    //Check the Files
    if(!req.files){
        return next(new ErrorHandler('Please Upload File.', 400));
    }

    const file = req.files.file;

    //Check File type
    const supportedFiles = /.docx|.pdf/;
    if(!supportedFiles.test(path.extname(file.name))){
        return next(new ErrorHandler('Please Upload The Correct Document File Format.', 400));
    }

    //Check the Document size
    if(file.size > process.env.MAX_FILE_SIZE) {
        return next(new ErrorHandler('Please Upload file which is less than 4MB',400));

    }

    // Renaming Resume
    file.name = `${req.user.name.replace(' ', '_')}_${job._id}${path.parse(file.name).ext}`;

    file.mv(`${process.env.UPLOAD_PATH}/${file.name}`, async err => {

        if(err){
            console.log(err);
            return next(new ErrorHandler('Resume Upload Failed.', 500));

        }

        await Job.findByIdAndUpdate(req.params.id, {$push : {
            applicantsApplied : {
                id: req.user.id,
                resume : file.name
            }
        }}, {
            new : true,
            runValidators : true, 
            useFindAndModify : false
        });

        res.status(200).json({
            success : true,
            message : 'Application to Job was Successful.',
            data : file.name
        })
    });
});