const express = require('express');
const axios = require('axios');
const { Log } = require('../logging_middleware/index');

const serverApp = express();
serverApp.use(express.json());

const LISTENING_PORT = 3001;
const ASSIGNMENT_ENDPOINT = 'http://4.224.186';
const SECURITY_CREDENTIAL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwiZXhwIjoxNzgwMTI0NDc1LCJpYXQiOjE3ODAxMjM1NzUsImlzcyI6IkFmZm9yZCBNZWRpY2FsIFRlY2hub2xvZ2llcyBQcml2YXRlIExpbWl0ZWQiLCJqdGkiOiIyODFiYzk4OC0wZjQ2LTRmOGUtOGI2OS1lZWRhZTIyY2NmYWMiLCJsb2NhbGUiOiJlbi1JTiIsIm5hbWUiOiJhdnVsYSB2aXNobnUgcHJpeWEiLCJzdWIiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQifSwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwibmFtZSI6ImF2dWxhIHZpc2hudSBwcml5YSIsInJvbGxObyI6IjIzMDAwMzkwMTgiLCJhY2Nlc3NDb2RlIjoiQXZyQUFLIiwiY2xpZW50SUQiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQiLCJjbGllbnRTZWNyZXQiOiJVdVVWRk1hREZnakdKQ2JuIn0.XoJ5aLirK3RUsFRmBusAMCdyMoUUkFcf3CcNvaq5CRc";

const createAuthContext = () => ({
  headers: { 'Authorization': `Bearer ${SECURITY_CREDENTIAL}` }
});

const executeJobAllocation = (taskRegistry, timeThreshold) => {
  const datasetSize = taskRegistry.length;
  
  const computationGrid = Array.from({ length: datasetSize + 1 }, () => 
    new Int32Array(timeThreshold + 1).fill(0)
  );

  for (let nodeIdx = 1; nodeIdx <= datasetSize; nodeIdx++) {
    const currentRecord = taskRegistry[nodeIdx - 1];
    const timeCost = currentRecord.Duration || 0;
    const priorityWeight = currentRecord.Impact || 0;

    for (let trackingHour = 0; trackingHour <= timeThreshold; trackingHour++) {
      computationGrid[nodeIdx][trackingHour] = (timeCost <= trackingHour)
        ? Math.max(priorityWeight + computationGrid[nodeIdx - 1][trackingHour - timeCost], computationGrid[nodeIdx - 1][trackingHour])
        : computationGrid[nodeIdx - 1][trackingHour];
    }
  }

  let remainingAllowance = timeThreshold;
  const targetTaskIdentifiers = [];

  for (let nodeIdx = datasetSize; nodeIdx > 0; nodeIdx--) {
    if (computationGrid[nodeIdx][remainingAllowance] !== computationGrid[nodeIdx - 1][remainingAllowance]) {
      const selectedNode = taskRegistry[nodeIdx - 1];
      targetTaskIdentifiers.push(selectedNode.TaskID);
      remainingAllowance -= (selectedNode.Duration || 0);
    }
  }

  return {
    cumulativeImpact: computationGrid[datasetSize][timeThreshold],
    utilizedHours: timeThreshold - remainingAllowance,
    compiledTasks: targetTaskIdentifiers.reverse()
  };
};

serverApp.get('/process-schedule', async (requestObject, responseObject) => {
  try {
    await Log("backend", "info", "vehicle_maintenance_scheduler", "Connecting to data orchestration endpoint layer.");

    const queryContext = createAuthContext();
    const [depotStream, fleetStream] = await Promise.all([
      axios.get(`${ASSIGNMENT_ENDPOINT}/depots`, queryContext),
      axios.get(`${ASSIGNMENT_ENDPOINT}/vehicles`, queryContext)
    ]);

    const retrievedDepots = depotStream?.data?.depots || [];
    const retrievedVehicles = fleetStream?.data?.vehicles || [];

    const mappedSchedules = retrievedDepots.reduce((accumulator, activeDepot) => {
      const localLimit = activeDepot.MechanicHours || 0;
      const optimizedMetrics = executeJobAllocation(retrievedVehicles, localLimit);

      accumulator.push({
        depotID: activeDepot.ID,
        availableHours: localLimit,
        totalImpactScore: optimizedMetrics.cumulativeImpact,
        hoursUsed: optimizedMetrics.utilizedHours,
        assignedTasks: optimizedMetrics.compiledTasks
      });

      return accumulator;
    }, []);

    await Log("backend", "info", "vehicle_maintenance_scheduler", "Operational mapping matrix completed successfully.");
    return responseObject.status(200).json({ schedule: mappedSchedules });

  } catch (executionFault) {
    await Log("backend", "error", "vehicle_maintenance_scheduler", `Pipeline calculation fault event context: ${executionFault.message}`);
    return responseObject.status(500).json({ 
      error: "Unable to parse optimized scheduling parameters", 
      message: executionFault.message 
    });
  }
});

serverApp.listen(LISTENING_PORT, () => {
  console.log(`Optimization engine cluster processing online via interface ${LISTENING_PORT}`);
});
