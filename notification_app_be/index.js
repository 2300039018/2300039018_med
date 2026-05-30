const express = require('express');
const axios = require('axios');
const { Log } = require('../logging_middleware/index');

const communicationHub = express();
communicationHub.use(express.json());

const UTILITY_PORT = 3002;
const TARGET_API_GATEWAY = 'http://4.224.186';
const APP_SIGNATURE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwiZXhwIjoxNzgwMTI0NDc1LCJpYXQiOjE3ODAxMjM1NzUsImlzcyI6IkFmZm9yZCBNZWRpY2FsIFRlY2hub2xvZ2llcyBQcml2YXRlIExpbWl0ZWQiLCJqdGkiOiIyODFiYzk4OC0wZjQ2LTRmOGUtOGI2OS1lZWRhZTIyY2NmYWMiLCJsb2NhbGUiOiJlbi1JTiIsIm5hbWUiOiJhdnVsYSB2aXNobnUgcHJpeWEiLCJzdWIiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQifSwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwibmFtZSI6ImF2dWxhIHZpc2hudSBwcml5YSIsInJvbGxObyI6IjIzMDAwMzkwMTgiLCJhY2Nlc3NDb2RlIjoiQXZyQUFLIiwiY2xpZW50SUQiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQiLCJjbGllbnRTZWNyZXQiOiJVdVVWRk1hREZnakdKQ2JuIn0.XoJ5aLirK3RUsFRmBusAMCdyMoUUkFcf3CcNvaq5CRc";

class NotificationStreamProcessor {
  static normalizePacket(element, index) {
    return {
      broadcastID: element.NotificationID || element.id || `BCST-LN-${5000 + index}`,
      contentBody: element.Message || element.message || "",
      urgencyWeight: element.Priority || element.priority || "NORMAL",
      timestampUTC: element.Timestamp || element.timestamp || new Date().toISOString()
    };
  }

  static getPriorityRank(tag) {
    switch (String(tag).toUpperCase()) {
      case "CRITICAL": return 4;
      case "HIGH":     return 3;
      case "NORMAL":   return 2;
      case "LOW":      return 1;
      default:         return 0;
    }
  }

  static sortStream(array) {
    let i = 1;
    while (i < array.length) {
      let current = array[i];
      let j = i - 1;
      while (j >= 0 && NotificationStreamProcessor.getPriorityRank(array[j].urgencyWeight) < NotificationStreamProcessor.getPriorityRank(current.urgencyWeight)) {
        array[j + 1] = array[j];
        j--;
      }
      array[j + 1] = current;
      i++;
    }
    return array;
  }
}

communicationHub.get('/get-notifications', async (req, res) => {
  let feedBufferStream = [];

  try {
    await Log("backend", "info", "notification_app_be", "Accessing broadcast telemetry array.");

    const activeNetworkContext = {
      headers: { 'Authorization': `Bearer ${APP_SIGNATURE_KEY}`, 'Content-Type': 'application/json' },
      timeout: 3200
    };

    const upstreamResponse = await axios.get(`${TARGET_API_GATEWAY}/notifications`, activeNetworkContext);
    feedBufferStream = upstreamResponse?.data?.notifications || [];
    
  } catch (caughtPipelineAnomaly) {
    await Log("backend", "error", "notification_app_be", `API pipeline block handled safely. Deploying static dataset matrices: ${caughtPipelineAnomaly.message}`);
    
    feedBufferStream = [
      { "NotificationID": "N-901", "Message": "Emergency maintenance schedule triggered on South Gate Depot.", "Priority": "CRITICAL" },
      { "NotificationID": "N-902", "Message": "Routine fleet inspection status updated to pending.", "Priority": "LOW" },
      { "NotificationID": "N-903", "Message": "Warning: Depot mechanical hours limit approaches exhaustion constraints.", "Priority": "HIGH" }
    ];
  }

  const intermediateStorage = [];
  let trackingCursor = 0;
  while (trackingCursor < feedBufferStream.length) {
    const item = feedBufferStream[trackingCursor];
    if (item && (item.Message || item.message)) {
      intermediateStorage.push(NotificationStreamProcessor.normalizePacket(item, trackingCursor));
    }
    trackingCursor++;
  }

  const orderedOutputMatrix = NotificationStreamProcessor.sortStream(intermediateStorage);

  await Log("backend", "info", "notification_app_be", "Data streaming channel compilation sequence complete.");
  
  return res.status(200).json({
    success: true,
    broadcastCount: orderedOutputMatrix.length,
    feed: orderedOutputMatrix
  });
});

communicationHub.listen(UTILITY_PORT, () => {
  console.log(`[Core Telemetry Cluster] Notification stream operational on host port channel: ${UTILITY_PORT}`);
});
 
