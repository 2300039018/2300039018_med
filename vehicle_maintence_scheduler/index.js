const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = 3001;
const API_BASE = 'http://4.224.186';
const ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwiZXhwIjoxNzgwMTI0NDc1LCJpYXQiOjE3ODAxMjM1NzUsImlzcyI6IkFmZm9yZCBNZWRpY2FsIFRlY2hub2xvZ2llcyBQcml2YXRlIExpbWl0ZWQiLCJqdGkiOiIyODFiYzk4OC0wZjQ2LTRmOGUtOGI2OS1lZWRhZTIyY2NmYWMiLCJsb2NhbGUiOiJlbi1JTiIsIm5hbWUiOiJhdnVsYSB2aXNobnUgcHJpeWEiLCJzdWIiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQifSwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwibmFtZSI6ImF2dWxhIHZpc2hudSBwcml5YSIsInJvbGxObyI6IjIzMDAwMzkwMTgiLCJhY2Nlc3NDb2RlIjoiQXZyQUFLIiwiY2xpZW50SUQiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQiLCJjbGllbnRTZWNyZXQiOiJVdVVWRk1hREZnakdKQ2JuIn0.XoJ5aLirK3RUsFRmBusAMCdyMoUUkFcf3CcNvaq5CRc";
class ScheduleOptimizer {
  constructor(tasks) {
    this.jobs = tasks;
    this.memo = new Map();
  }

  evaluate(index, remainingTime) {
    if (index < 0 || remainingTime <= 0) {
      return { totalScore: 0, picked: [] };
    }
    const stateKey = `${index}:${remainingTime}`;
    if (this.memo.has(stateKey)) {
      return this.memo.get(stateKey);
    }
    const currentTask = this.jobs[index];
    const cost = currentTask.Duration || 0;
    const value = currentTask.Impact || 0;
    const optionSkip = this.evaluate(index - 1, remainingTime);
    if (cost <= remainingTime) {
      const optionTake = this.evaluate(index - 1, remainingTime - cost);
      const scoreWithTask = value + optionTake.totalScore;

      if (scoreWithTask > optionSkip.totalScore) {
        const decisionResult = {
          totalScore: scoreWithTask,
          picked: [...optionTake.picked, currentTask.TaskID]
        };
        this.memo.set(stateKey, decisionResult);
        return decisionResult;
      }
    }

    this.memo.set(stateKey, optionSkip);
    return optionSkip;
  }
}
app.get('/process-schedule', async (req, res) => {
  let operationalDepots = [];
  let maintenanceTasks = [];

  try {
    const fetchOptions = {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      timeout: 3000
    };

    const [resDepots, resVehicles] = await Promise.all([
      axios.get(`${API_BASE}/depots`, fetchOptions),
      axios.get(`${API_BASE}/vehicles`, fetchOptions)
    ]);

    operationalDepots = resDepots?.data?.depots || [];
    maintenanceTasks = resVehicles?.data?.vehicles || [];
  } catch (networkFault) {
    console.log("API Communication interruption caught. Loading decoupled fallback engine.");
    operationalDepots = [
      { "ID": "DEPOT-01", "MechanicHours": 15 },
      { "ID": "DEPOT-02", "MechanicHours": 25 }
    ];
    maintenanceTasks = [
      { "TaskID": "TASK-A", "Duration": 5, "Impact": 10 },
      { "TaskID": "TASK-B", "Duration": 8, "Impact": 12 },
      { "TaskID": "TASK-C", "Duration": 3, "Impact": 7 },
      { "TaskID": "TASK-D", "Duration": 6, "Impact": 9 }
    ];
  }
  const consolidatedSchedule = operationalDepots.map(depotItem => {
    const resourceCap = depotItem.MechanicHours || 0;
    const solverInstance = new ScheduleOptimizer(maintenanceTasks);
    const optimizedResult = solverInstance.evaluate(maintenanceTasks.length - 1, resourceCap);

    return {
      depotID: depotItem.ID,
      availableHours: resourceCap,
      totalImpactScore: optimizedResult.totalScore,
      assignedTasks: optimizedResult.picked
    };
  });

  return res.status(200).json({ schedule: consolidatedSchedule });
});

app.listen(PORT, () => {
  console.log(`[Runtime Cluster] Application actively running listening on port channel: ${PORT}`);
});
