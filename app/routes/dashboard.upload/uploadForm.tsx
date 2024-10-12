import { useState, useRef } from 'react';
import { BlankDocumentIcon } from '../../components/svg_icons';

export default function UploadForm() {
    // Create a ref to the file input field
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Define states
    const [files, setFiles] = useState<any>([]);
    const [enter, setEnter] = useState<Boolean>(false);

    const handleDrop = (event: any) => {
        event.preventDefault();
        // Assign dropped files to the file input field
        fileInputRef.current!.files = event.dataTransfer.files;
        // Set the dropped files to display
        let droppedFiles = event.dataTransfer.files;
        files.push(...droppedFiles);
        setFiles([ ...files ]);
    };

    // Handle Drag events
    const handleDragOver = (event: any) => {
        event.preventDefault();
        console.log('dragover');
    };

    const handleDragEnter = (event: any) => {
        setTimeout(() => setEnter(true), 100);
        console.log('dragenter');
    };

    const handleDragLeave = (event: any) => {
        setTimeout(() => setEnter(false), 100);
        console.log('dragleave');
    }

    // Delete the relative document item
    const handleDelete = (event: any) => {
        const parent = event.target.parentElement;
        const index = parent.getAttribute('index-remove'); // Get the index of the item to remove.
        if (index != null) {
            files.splice(index, 1);
            setFiles([ ...files ]);
        };
        // Place the UI back to default if no files exist anymore
        if (files.length === 0 ) {
            setEnter(false);
        };
    };

    const handleUpdate = (event: any) => {
        let droppedFiles = event.target.files;
        files.push(...droppedFiles); // Push in new files
        setFiles([ ...files ]);
    }

    return (
        <form action="" className="flex flex-col gap-6 w-full justify-center items-start">
            {/* <label htmlFor="file_input" className="rounded-md px-3 py-1 bg-slate-500 cursor-pointer">
                Upload Document
            </label>
            <input id="file_input" type="file" name="file"/> */}
            <div id="dropArea" onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
            className='outline-dotted outline-2 outline-tertiary p-3 flex flex-col w-full h-full gap-3 rounded-xl'>
            {
                files.length != 0 ? 
                files.map((file: any, index: number) => (
                    // TODO: Improve on file item ui, such as a better button
                    <div key={index} index-remove={index} className='flex flex-row justify-between bg-tertiary rounded-lg px-4 py-2'>
                        <div className='flex flex-row gap-2 items-center'>
                            <BlankDocumentIcon width={20} height={20} hexColor='currentColor' />
                            <p>{file.name}</p>
                        </div>
                        <button onClick={handleDelete} type='button'>X</button>
                    </div>
                )) : enter ? 
                <div className='flex justify-center items-center w-fit m-auto'>
                    <p>DROP IT IN ALREADY</p>
                </div> : 
                // This is the div for when no files are present
                <div className='flex flex-row gap-4 justify-center items-center w-fit m-auto'>
                    <div className='rounded-full bg-neutral-800 p-4'>
                        <BlankDocumentIcon width={35} height={35} hexColor='currentColor'/>
                    </div>
                    <div>
                        <p>Drag and Drop files here</p>
                        <p>Or &nbsp;
                            <label htmlFor="fileInput" className='cursor-pointer underline text-tertiary'>Choose File</label>
                        </p>
                    </div>
                </div>
            }
            </div>
            <input ref={fileInputRef} id='fileInput' type="file" name="file" multiple hidden onChange={handleUpdate}/>

            <div className='flex flex-row gap-2 items-baseline'>
                <button type="submit" className="bg-accent text-primary px-3 py-1 rounded-md flex flex-row gap-2 items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="size-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                    </svg>
                    <p className='text-lg'>Upload Files</p>
                </button>
                <p className='text-xs text-stone-700'>Project Francium™ is not responsible for any breach of data privacy. Please ensure that all files uploaded are appropriate and do not contain personal information.</p>
            </div>

        </form>
    );
}