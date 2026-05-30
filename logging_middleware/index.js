const axios = require('axios');

const sanitizeInput = (textData) => String(textData ?? '').trim().toLowerCase();

const Log = async (stack, level, packageField, message) => {
  const REMOTE_LOG_PATH = "http://4.224.186";
  const AUTH_CREDENTIAL = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwiZXhwIjoxNzgwMTI0NDc1LCJpYXQiOjE3ODAxMjM1NzUsImlzcyI6IkFmZm9yZCBNZWRpY2FsIFRlY2hub2xvZ2llcyBQcml2YXRlIExpbWl0ZWQiLCJqdGkiOiIyODFiYzk4OC0wZjQ2LTRmOGUtOGI2OS1lZWRhZTIyY2NmYWMiLCJsb2NhbGUiOiJlbi1JTiIsIm5hbWUiOiJhdnVsYSB2aXNobnUgcHJpeWEiLCJzdWIiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQifSwiZW1haWwiOiIyMzAwMDM5MDE4Y3NlaDJAZ21haWwuY29tIiwibmFtZSI6ImF2dWxhIHZpc2hudSBwcml5YSIsInJvbGxObyI6IjIzMDAwMzkwMTgiLCJhY2Nlc3NDb2RlIjoiQXZyQUFLIiwiY2xpZW50SUQiOiI1MTEzNjBjMi0xZTJhLTRiZGMtYWIzNy1hMzNjYmIzYWViMmQiLCJjbGllbnRTZWNyZXQiOiJVdVVWRk1hREZnakdKQ2JuIn0.XoJ5aLirK3RUsFRmBusAMCdyMoUUkFcf3CcNvaq5CRc";
  const logEnvelope = Object.freeze({
    stack: sanitizeInput(stack),
    level: sanitizeInput(level),
    package: sanitizeInput(packageField),
    message: typeof message === 'object' ? JSON.stringify(message) : String(message)
  });

  const transportContext = {
    headers: {
      "Authorization": `Bearer ${AUTH_CREDENTIAL}`,
      "Content-Type": "application/json"
    }
  };

  return axios.post(REMOTE_LOG_PATH, logEnvelope, transportContext)
    .then(networkSuccess => networkSuccess.data)
    .catch(networkFault => {
      const traceReason = networkFault?.message || 'Trace channel interrupted';
      console.warn(`[System Audit Notice] Event routing bypassed: ${traceReason}`);
      return null;
    });
};

module.exports = { Log };
