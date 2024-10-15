import { db } from '../firebase'; // Correct path to your Firebase config
import { doc, getDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

const calculateAndStorePositions = async (transactionId, result) => {
  try {
    // Fetch the transaction data
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);

    if (!transactionSnap.exists()) {
      throw new Error('Transaction does not exist.');
    }

    const transactionData = transactionSnap.data();

    // Fetch client messages
    const clientMessagesQuery = query(
      collection(db, 'messages_client'),
      where('transactionId', '==', transactionId),
      where('type', '==', 'client_fill')
    );
    const clientMessagesSnap = await getDocs(clientMessagesQuery);

    if (clientMessagesSnap.empty) {
      throw new Error('No client messages found');
    }

    const clientData = clientMessagesSnap.docs[0].data();

    // Fetch agent messages
    const agentsMessagesQuery = query(
      collection(db, 'messages_agents'),
      where('transactionId', '==', transactionId),
      where('type', '==', 'agent_fill')
    );
    const agentsMessagesSnap = await getDocs(agentsMessagesQuery);

    if (agentsMessagesSnap.empty) {
      throw new Error('No agent messages found');
    }

    const agentsData = agentsMessagesSnap.docs.map(doc => doc.data());

    // Define the positions sub-collection
    const positionsCollectionRef = collection(transactionRef, 'positions');

    // Perform calculations and store results based on the transaction result
    if (result.toLowerCase() === 'win') {
      await storeWinPositions(positionsCollectionRef, transactionData, clientData, agentsData);
    } else if (result.toLowerCase() === 'loss') {
      await storeLossPositions(positionsCollectionRef, transactionData, clientData, agentsData);
    } else if (result.toLowerCase() === 'void') {
      await storeVoidPositions(positionsCollectionRef);
    } else {
      throw new Error('Invalid transaction result.');
    }

    console.log(`Positions successfully stored for transaction ${transactionId}`);
  } catch (error) {
    console.error('Error calculating or storing positions:', error);
  }
};

const storeWinPositions = async (positionsCollectionRef, transactionData, clientData, agentsData) => {
  const clientAmount = clientData.client_amount;
  const clientPrice = clientData.client_price;
  const clientPayout = clientAmount * clientPrice;
  let agentTotalPayout = 0;

  // Store each agent's liability
  for (const agent of agentsData) {
    const agentPayout = agent.amount * agent.price;
    agentTotalPayout += agentPayout;

    await addDoc(positionsCollectionRef, {
      nomcode: agent.agentName,
      DR: agentPayout,
      CR: 0,
      timestamp: new Date().toISOString(),
    });
  }

  // Store client's position
  await addDoc(positionsCollectionRef, {
    nomcode: 'Client',
    DR: 0,
    CR: clientPayout,
    timestamp: new Date().toISOString(),
  });

  // Store company's position
  const companyNetPosition = agentTotalPayout - clientPayout;
  await addDoc(positionsCollectionRef, {
    nomcode: 'Company',
    DR: clientPayout, // What the company owes to the client
    CR: agentTotalPayout, // What the company gains from agents
    netPosition: companyNetPosition, // Store the company's net position
    timestamp: new Date().toISOString(),
  });
};

const storeLossPositions = async (positionsCollectionRef, transactionData, clientData, agentsData) => {
  const clientAmount = clientData.client_amount;
  let agentTotal = 0;

  // Store each agent's stakes
  for (const agent of agentsData) {
    agentTotal += agent.amount;

    await addDoc(positionsCollectionRef, {
      nomcode: agent.agentName,
      DR: 0,
      CR: agent.amount,
      timestamp: new Date().toISOString(),
    });
  }

  // Store client's position (loss)
  await addDoc(positionsCollectionRef, {
    nomcode: 'Client',
    DR: clientAmount,
    CR: 0,
    timestamp: new Date().toISOString(),
  });

  // Store company's position
  await addDoc(positionsCollectionRef, {
    nomcode: 'Company',
    DR: clientAmount,
    CR: agentTotal,
    timestamp: new Date().toISOString(),
  });
};

const storeVoidPositions = async (positionsCollectionRef, agentsData) => {
  // Store void position for each agent involved
  for (const agent of agentsData) {
    await addDoc(positionsCollectionRef, {
      nomcode: agent.agentName,
      DR: 0,
      CR: 0,
      timestamp: new Date().toISOString(),
    });
  }

  // Store void position for the client
  await addDoc(positionsCollectionRef, {
    nomcode: 'Client',
    DR: 0,
    CR: 0,
    timestamp: new Date().toISOString(),
  });

  // Store void position for the company
  await addDoc(positionsCollectionRef, {
    nomcode: 'Company',
    DR: 0,
    CR: 0,
    timestamp: new Date().toISOString(),
  });
};


export default calculateAndStorePositions;
