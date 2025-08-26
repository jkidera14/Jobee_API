const express = require('express');
const router = express.Router();

// Importing Jobs controller methods
const { 
    getJobs,
    getJob,
    newJob,
    getJobsInRadius,
    updateJob,
    deleteJob,
    jobStats

} = require('../controllers/jobsController');

const { isAuthenticatedUser, authorizeRoles} = require('../middlewares/auth');

router.route('/jobs').get(getJobs);
router.route('/job/:id/:slug').get(getJob);
router.route('/jobs/:zipcode/:distance').get(getJobsInRadius);
router.route('/stats/:topic').get(jobStats);

router.route('/job/new').post(isAuthenticatedUser, authorizeRoles
    ('employer', 'admin'), newJob);
//Since they are sharing the same route, we do them/ co-join them here
router.route('/job/:id')
            .put(isAuthenticatedUser, authorizeRoles
                ('employer', 'admin'), updateJob)
            .delete(isAuthenticatedUser, authorizeRoles
                ('employer', 'admin') ,deleteJob);

module.exports = router;