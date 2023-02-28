const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000);
    console.log("Server running at http://localhost:3000");
  } catch (e) {
    console.log(e.message);
  }
};
initializeDBAndServer();

const createItemInDistrict = (request, response, next) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) VALUES('${districtName}',${stateId},${cases}.${cured},${active},${deaths})`;
  next();
};

const getDistrictDetails = async (request, response, next) => {
  const { districtId } = request.params;
  const districtDetailsQuery = `SELECT district_id AS districtId,district_name AS districtName,state_id AS stateId,cases,cured,active,deaths FROM district WHERE district_id = ${districtId}`;
  let dbResponse = await db.get(districtDetailsQuery);
  /* const convertToCamelCase = (array) => {
    const convertedObj = array.map((obj) => {
      return {
        districtId: obj.district_id,
        districtName: obj.district_name,
        stateId: obj.state_id,
        cases: obj.cases,
        cured: obj.cured,
        active: obj.active,
        deaths: obj.deaths,
      };
    });
    return convertedObj;
  };  */

  request.tobeSend = dbResponse;
  next();
};

const deleteDistrict = async (request, response, next) => {
  const { districtId } = request.params;
  const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId}`;
  await db.run(deleteQuery);
  next();
};

const updateDistrict = async (request, response, next) => {
  const { districtId } = request.params;
  const districtDetails = request.body;
  console.log(districtDetails);
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const updateQuery = `UPDATE district SET district_name = '${districtName}',state_id = '${stateId}',cases = '${cases}',active = '${active}',deaths = '${deaths}'`;
  const dbResponse = await db.run(updateQuery);
  next();
};

const getSats = async (request, response, next) => {
  const { stateId } = request.params;
  const getStatsQuery = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM district WHERE state_id = ${stateId};`;
  let dbResponse = await db.get(getStatsQuery);
  request.dbResponse = dbResponse;
  next();
};

const authenticToken = (request, response, next) => {
  const authHeader = request.headers.authorization;
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "B", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const checkValidUserOrNot = async (request, response, next) => {
    const userName = request.body.username;
    const validUserQuery = `SELECT * FROM user WHERE username LIKE '${userName}'`;
    const dbResponse = await db.get(validUserQuery);
  if (dbResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    next();
  }
};

const correctPasswordOrNot = async (request, response, next) => {
  const userName = request.body.username;
  const password = request.body.password;
  const checkPasswordQuery = `SELECT * FROM user WHERE username LIKE '${userName}'`;
  const dbResponse = await db.get(checkPasswordQuery);
  const dbPassword = dbResponse.password;
  const result = await bcrypt.compare(password, dbPassword);
  if (result === true) {
    const payload = { username: userName };
    const jwtToken = jwt.sign(payload, "B");
    request.jwtToken = jwtToken;
    next();
  } else {
    response.status(400);
    response.send("Invalid password");
  }
};

//API 1
app.post(
  "/login/",
  checkValidUserOrNot,
  correctPasswordOrNot,
  (request, response) => {
    response.send(request.jwtToken);
  }
);

//API 2
app.get("/states/", authenticToken, async (request, response) => {
  const getQuery = `SELECT * FROM state`;
  const dbResponse = await db.all(getQuery);
  response.send(dbResponse);
});

//API 3
app.get("/states/:stateId/", authenticToken, async (request, response) => {
  const { stateId } = request.params;
  const getQuery = `SELECT state_id AS stateId, state_name AS stateName,population  FROM state WHERE state_id = ${stateId}`;
  const dbResponse = await db.get(getQuery);
  response.send(dbResponse);
});

//API 4
app.post(
  "/districts/",
  authenticToken,
  createItemInDistrict,
  (request, response) => {
    response.send("District Successfully Added");
  }
);

//API 5
app.get(
  "/districts/:districtId/",
  authenticToken,
  getDistrictDetails,
  (request, response) => {
    response.send(request.tobeSend);
  }
);

//API 6
app.delete(
  "/districts/:districtId/",
  authenticToken,
  deleteDistrict,
  (request, response) => {
    response.send("District Remove");
  }
);

//API 7
app.put(
  "/districts/:districtId/",
  authenticToken,
  updateDistrict,
  (request, response) => {
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticToken,
  getSats,
  (request, response) => {
    response.send(request.dbResponse);
  }
);

module.exports = app;
