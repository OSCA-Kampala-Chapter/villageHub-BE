const AWS = require('aws-sdk');
AWS.config.update({
  region: 'us-east-2',
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbTableName = 'complaints';
const complaintsPath = '/complaints';
const complaintPath = '/complaint';
const productsPath = '/products';

exports.handler = async (event) => {
  console.log('Request event: ', event);
  let response;
  switch (true) {
    case event.httpMethod === 'GET' && event.path === complaintsPath:
      response = await getComplaints();
      break;
    case event.httpMethod === 'GET' && event.path === complaintPath:
      response = await getComplaint(
        event.queryStringParameters.id,
        event.queryStringParameters.sort_id,
      );
      break;
    case event.httpMethod === 'POST' && event.path === complaintPath:
      response = await saveComplaint(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH' && event.path === complaintPath:
      const requestBody = JSON.parse(event.body);
      response = await modifyComplaint(
        requestBody.id,
        requestBody.sort_id,
        requestBody.updateKey,
        requestBody.updateValue,
      );
      break;
    case event.httpMethod === 'DELETE' && event.path === complaintPath:
      response = await deleteComplaint(JSON.parse(event.body).id, JSON.parse(event.body).sort_id);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
};

const getComplaints = async () => {
  const params = {
    TableName: dynamodbTableName,
  };
  const allComplaints = await scanDynamoRecords(params, []);
  const body = {
    complaints: allComplaints,
  };
  return buildResponse(200, body);
};

const getComplaint = async (id, sort_id) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      id: id,
      sort_id: sort_id,
    },
  };
  return await dynamodb
    .get(params)
    .promise()
    .then(
      (response) => {
        return buildResponse(200, response.Item);
      },
      (error) => {
        console.error('error ', error);
        return buildResponse(500, error);
      },
    );
};

const saveComplaint = async (requestBody) => {
  const params = {
    TableName: dynamodbTableName,
    Item: requestBody,
  };
  return await dynamodb
    .put(params)
    .promise()
    .then(
      () => {
        const body = {
          Operation: 'SAVE',
          Message: 'SUCCESS',
          Item: requestBody,
        };
        return buildResponse(200, body);
      },
      (error) => {
        console.error('error', error);
        return buildResponse(500, error);
      },
    );
};

const modifyComplaint = async (id, sort_id, updateKey, updateValue) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      id: id,
      sort_id: sort_id,
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ':value': updateValue,
    },
    ReturnValues: 'UPDATED_NEW',
  };
  return await dynamodb
    .update(params)
    .promise()
    .then(
      (response) => {
        const body = {
          Operation: 'UPDATE',
          Message: 'SUCCESS',
          UpdatedAttributes: response,
        };
        return buildResponse(200, body);
      },
      (error) => {
        console.error('error', error);
        return buildResponse(500, error);
      },
    );
};

const scanDynamoRecords = async (scanParams, itemArray) => {
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch (error) {
    console.error('error', error);
    return buildResponse(500, error);
  }
};

const deleteComplaint = async (id, sort_id) => {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      id: id,
      sort_id: sort_id,
    },
    ReturnValues: 'ALL_OLD',
  };
  return await dynamodb
    .delete(params)
    .promise()
    .then(
      (response) => {
        const body = {
          Operation: 'DELETE',
          Message: 'SUCCESS',
          Item: response,
        };
        return buildResponse(200, body);
      },
      (error) => {
        console.error('error', error);
        return buildResponse(500, error);
      },
    );
};

const buildResponse = (statusCode, body) => {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
};
