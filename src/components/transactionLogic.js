import { doc, updateDoc, collection, addDoc, getDocs, query, where, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const handleTransactionResult = async (transactionId, selectedResult) => {
  const transactionRef = doc(db, 'transactions', transactionId);
  
  // Fetch the actual transaction document
  const transactionDoc = await getDoc(transactionRef);

  if (!transactionDoc.exists()) {
    console.error("Transaction document not found");
    return;
  }

  const transactionData = transactionDoc.data(); // Extract the transaction document data

  // Update the transaction document
  await updateDoc(transactionRef, {
    status: 'Closed-Settled',
    result: selectedResult,
  });

  // If the result is "lose", perform additional logic
  if (selectedResult === 'lose') {
    // Lookup the `messages_client` collection where `transactionId` equals the `transactionId` and type equals `client_fill`
    const messagesClientQuery = query(
      collection(db, 'messages_client'),
      where('transactionId', '==', transactionId),
      where('type', '==', 'client_fill')
    );
    const messagesClientSnapshot = await getDocs(messagesClientQuery);

    if (!messagesClientSnapshot.empty) {
      const clientData = messagesClientSnapshot.docs[0].data();
      const clientAmount = clientData.client_amount;

      // Ensure all necessary fields are defined, use default values if needed
      const nomname = transactionData.requestby || 'Unknown Requestor';
      const date = transactionData.datetime || new Date(); // Default to current date
      const ref = transactionData.event || 'Unknown Event';
      const details = transactionData.bet || 'Unknown Bet';
      const notes = selectedResult;

      // Sub-collection reference for "Journals"
      const journalsSubCollectionRef = collection(transactionRef, 'Journals');

      // First record: B/S account entry (Debit)
      await addDoc(journalsSubCollectionRef, {
        jrnl_no: 1,
        acc_type: 'B/S',
        nomcode: 1000,
        nomname: nomname, // Ensure this is defined
        date: date,
        ref: ref,
        details: details,
        DR: Number(clientAmount),
        CR: 0,
        Notes: notes,
        systype: 'fromResult',
      });

      // Second record: P&L account entry (Credit)
      await addDoc(journalsSubCollectionRef, {
        jrnl_no: 1,
        acc_type: 'P&L',
        nomcode: 4000,
        nomname: nomname, // Ensure this is defined
        date: date,
        ref: ref,
        details: details,
        DR: 0,
        CR: Number(clientAmount),
        Notes: notes,
        systype: 'fromResult',
      });
    } else {
      console.log("No matching client data found in messages_client.");
    }
  }
};


// Function to handle generating journal entries based on agents involved
export const generateAgentJournals = async (transactionId, selectedResult) => {
  try {
    // Step 1: Fetch the actual transaction document from the 'transactions' collection
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      console.error("Transaction document not found");
      return;
    }

    const transactionData = transactionDoc.data(); // Extract the transaction document data

    // Update the transaction document
    await updateDoc(transactionRef, {
        status: 'Closed-Settled',
        result: selectedResult,
    });

    // Step 2: Query messages_agents for the given transactionId and type 'agent_fill'
    const messagesAgentsRef = collection(db, 'messages_agents');
    const q = query(messagesAgentsRef, where('transactionId', '==', transactionId), where('type', '==', 'agent_fill'));

    // Fetch all matching documents
    const querySnapshot = await getDocs(q);

    // Step 3: Extract distinct agentId values and their associated amounts
    const agentAmounts = {}; // Will store agentId and their respective amount
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (!agentAmounts[data.agentId]) {
        agentAmounts[data.agentId] = parseFloat(data.amount); // Initialize with the agent amount, converted to a number
      }
    });

    // Step 4: Ensure necessary fields are defined from transactionData
    const date = transactionData.datetime || new Date(); // Default to current date if not defined
    const ref = transactionData.event || 'Unknown Event';
    const details = transactionData.bet || 'Unknown Bet';
    const notes = selectedResult;

    // Step 5: Sub-collection reference for "Journals" in the current transaction
    const journalsSubCollectionRef = collection(transactionRef, 'Journals'); // Reference to the Journals sub-collection

    // Step 6: Generate journal entries per distinct agentId
    let jrnlNo = 2; // Initialize the journal number, adjust as needed based on your logic
    for (const [agentId, messageAgentAmount] of Object.entries(agentAmounts)) {
      // Find the agent name from the AssignedAgents array
      const assignedAgent = transactionData.AssignedAgents.find((agent) => agent === agentId);
      const agentName = assignedAgent ? assignedAgent : 'Unknown Agent';

      // First journal entry (B/S)
      await addDoc(journalsSubCollectionRef, {
        jrnl_no: jrnlNo,
        acc_type: 'B/S',
        nomcode: 2000,
        nomname: agentName,
        date: date,
        ref: ref,
        details: details,
        DR: 0, // Debit the amount for the agent from messages_agents
        CR: Number(messageAgentAmount), // Explicit conversion to a number
        Notes: notes,
        systype: 'fromResult',
      });

      // Second journal entry (P&L)
      await addDoc(journalsSubCollectionRef, {
        jrnl_no: jrnlNo,
        acc_type: 'P&L',
        nomcode: 5000,
        nomname: agentName,
        date: date,
        ref: ref,
        details: details,
        DR: Number(messageAgentAmount), // Explicit conversion to a number
        CR: 0, // No credit for this entry
        Notes: notes,
        systype: 'fromResult',
      });

      // Increment journal number for the next agent
      jrnlNo += 1;
    }

    console.log('Journals successfully generated for all agents.');
    // Return the last journal number
    return jrnlNo;
  } catch (error) {
    console.error('Error generating journals:', error);
  }
};


// Function to handle generating the additional journal entries
export const generateAdditionalJournals = async (transactionId, selectedResult, lastJrnlNo) => {
  try {
    // Step 1: Fetch the actual transaction document from the 'transactions' collection
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionDoc = await getDoc(transactionRef);

    if (!transactionDoc.exists()) {
      console.error("Transaction document not found");
      return;
    }

    const transactionData = transactionDoc.data(); // Extract the transaction document data

    await updateDoc(transactionRef, {
        status: 'Closed-Settled',
        result: selectedResult,
        });

    // Step 2: Query messages_agents for the given transactionId and type 'agent_fill'
    const messagesAgentsRef = collection(db, 'messages_agents');
    const agentQuery = query(messagesAgentsRef, where('transactionId', '==', transactionId), where('type', '==', 'agent_fill'));

    // Fetch all matching agent documents
    const agentQuerySnapshot = await getDocs(agentQuery);

    // Step 3: Extract distinct agentId values and their associated amounts
    let totalMessageAgentAmount = 0; // To store the total message agent amount
    const agentAmounts = {}; // Will store agentId and their respective amount
    agentQuerySnapshot.forEach((doc) => {
      const data = doc.data();
      const amount = Number(data.amount);
      if (!agentAmounts[data.agentId]) {
        agentAmounts[data.agentId] = amount;
        totalMessageAgentAmount += amount; // Sum all agent amounts
      }
    });

    // Step 4: Query the messages_client collection for the clientAmount
    let clientAmount = 0; // Default client amount
    if (selectedResult === 'lose') {
      const messagesClientQuery = query(
        collection(db, 'messages_client'),
        where('transactionId', '==', transactionId),
        where('type', '==', 'client_fill')
      );
      const messagesClientSnapshot = await getDocs(messagesClientQuery);

      if (!messagesClientSnapshot.empty) {
        const clientData = messagesClientSnapshot.docs[0].data();
        clientAmount = Number(clientData.client_amount); // Ensure clientAmount is a number
      }
    }

    // Step 5: Ensure necessary fields are defined from transactionData
    const date = transactionData.datetime || new Date(); // Default to current date if not defined
    const ref = transactionData.event || 'Unknown Event';
    const details = transactionData.bet || 'Unknown Bet';
    const notes = selectedResult;

    // Step 6: Sub-collection reference for "Journals" in the current transaction
    const journalsSubCollectionRef = collection(transactionRef, 'Journals'); // Reference to the Journals sub-collection

    let jrnlNo = lastJrnlNo;
    // Step 7: Generate two new journal entries based on the remaining amount
    const remainingAmount = totalMessageAgentAmount - clientAmount; // Calculate the remaining amount

    // Generate the first new journal entry (B/S)
    await addDoc(journalsSubCollectionRef, {
      jrnl_no: jrnlNo, // Adjust based on your journal numbering system
      acc_type: 'B/S',
      nomcode: 2001,
      nomname: "DLA", // Defined as "DLA"
      date: date,
      ref: ref,
      details: details,
      DR: remainingAmount, // Debit the remaining amount
      CR: 0, // No credit for this entry
      Notes: notes,
      systype: 'fromResult',
    });

    // Generate the second new journal entry (P&L)
    await addDoc(journalsSubCollectionRef, {
      jrnl_no: jrnlNo, // Increment from the last journal number
      acc_type: 'P&L',
      nomcode: 5000,
      nomname: "internal", // Defined as "internal"
      date: date,
      ref: ref,
      details: details,
      DR: 0, // No debit for this entry
      CR: remainingAmount, // Credit the remaining amount
      Notes: notes,
      systype: 'fromResult',
    });

    console.log('Additional journals successfully generated and transaction updated.');
  } catch (error) {
    console.error('Error generating additional journals:', error);
  }
};
