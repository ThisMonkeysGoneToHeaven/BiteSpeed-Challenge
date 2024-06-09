import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

interface Contact{
    id: number,
    phoneNumber: string | null,
    email: string | null,
    linkedId: number | null,
    linkPrecedence: string,
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date | null
}

const checkNewInfo = async (primaryContactId: number, phoneNumber: string | null, email: string | null) => {

    const response = await prepareResponse(primaryContactId);
    let newEmailFound = email == null ? false : true;
    let newPhoneFound = phoneNumber == null ? false : true;

    if(newEmailFound && email){
        if(response.contact.emails.includes(email))
           newEmailFound = false; 
    }

    if(newPhoneFound && phoneNumber){
        if(response.contact.phoneNumbers.includes(phoneNumber))
            newPhoneFound = false;
    }    

    return newEmailFound || newPhoneFound;
};

const getMatchingPrimaries = async (phoneNumber: string | null, email: string | null) => {

    let matchingPrimaryIds = new Set<number>();

    if(phoneNumber){
        const phoneMatches = await prisma.contact.findMany({
            where: {
                phoneNumber: phoneNumber,
            }
        });

        for(let match of phoneMatches){
            const primaryId = match.linkedId || match.id;
            matchingPrimaryIds.add(primaryId);
        }
    }

    if(email){
        const emailMatches = await prisma.contact.findMany({
            where: {
                email: email,
            }
        });
    
        for(let match of emailMatches){
            const primaryId = match.linkedId || match.id;
            matchingPrimaryIds.add(primaryId);
        }
    }

    return matchingPrimaryIds;
};

const linking = async (matchingPrimaries: Set<number>) => {

    // no linking needed as only one or no primaryIds found
    if(matchingPrimaries.size < 2){
        if(matchingPrimaries.size == 1)
            return matchingPrimaries.values().next().value;
        return null; // null signifies no matching primaryId yet
    }
    
    // conveting set into an array
    let matchingPrimariesArray = [...matchingPrimaries];
    // the minimum-id primary contact will be mainPrimaryId
    const mainPrimaryId = Math.min(...matchingPrimariesArray);
    // remove the mainPrimaryId from the array
    matchingPrimariesArray = matchingPrimariesArray.filter(elem => elem !== mainPrimaryId);

    const matchedContacts = await prisma.contact.findMany({
        where: {
           OR: [
            {
                id: {
                    in: matchingPrimariesArray
                }
            },
            {   
                linkedId: {
                    in: matchingPrimariesArray
                }
            }
           ]
        }
    });

    for(let contact of matchedContacts){
        await prisma.contact.update({
            where: {
                id: contact.id
            },
            data: {
                linkedId: mainPrimaryId,
                linkPrecedence: 'secondary',
                updatedAt: new Date()
            }
        });
    }

    return mainPrimaryId;
};

const adding = async (mainPrimaryId: number, phoneNumber: string | null, email: string | null) => {

    // mainPrimaryId == null i.e. no prior match found, add as a PRIMARY contact
    if(mainPrimaryId == null){
        const createdContact = await prisma.contact.create({
            data: {
                phoneNumber: phoneNumber,
                email: email,
                linkedId: null,
                linkPrecedence: 'PRIMARY',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            }
        });
        return createdContact.id;
    }

    // add as a secondary contact linked to the mainPrimaryId 
    const newInfoFound = await checkNewInfo(mainPrimaryId, phoneNumber, email);
    if(newInfoFound){
        await prisma.contact.create({
            data: {
                phoneNumber: phoneNumber,
                email: email,
                linkedId: mainPrimaryId,
                linkPrecedence: 'SECONDARY',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            }
        });
    }
    
    return mainPrimaryId;
}

const prepareResponse = async (finalMainPrimaryId: number) => {
    
    const primaryContact= await prisma.contact.findFirst({
        where:{
            id: finalMainPrimaryId
        }
    });

    if(primaryContact == null)
        throw new Error('An error occured. No primary contact found!');

    let emails = [], phoneNumbers = [], secondaryContactIds = [];
    
    if(primaryContact.email)
        emails.push(primaryContact.email);
    if(primaryContact.phoneNumber)
        phoneNumbers.push(primaryContact.phoneNumber);

    const secondaryContacts = await prisma.contact.findMany({
        where:{
            linkedId: finalMainPrimaryId
        }
    });

    for(let secContact of secondaryContacts){
        secondaryContactIds.push(secContact.id);
        if(secContact.email && !(emails.includes(secContact.email)))
            emails.push(secContact.email);
        if(secContact.phoneNumber && !(phoneNumbers.includes(secContact.phoneNumber)))
            phoneNumbers.push(secContact.phoneNumber);
    }

    const response = {
        contact:{
            primaryContactId: finalMainPrimaryId,
            emails,
            phoneNumbers,
            secondaryContactIds
        }
    };

    return response;
}

export default async function handleContact(phoneNumber: string  | null, email: string | null) {

    const matchingPrimaryIds = await getMatchingPrimaries(phoneNumber, email);

    // linking
    const mainPrimaryId = await linking(matchingPrimaryIds);

    // adding
    const finalMainPrimaryId = await adding(mainPrimaryId, phoneNumber, email);

    if(!finalMainPrimaryId){
        return {
            message: 'Something went wrong during the "adding" procees',
            code: '500'
        }
    }

    const response = await prepareResponse(finalMainPrimaryId);

    await prisma.$disconnect();   
    return response;
}