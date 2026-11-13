import { FileDropzone } from './ui/index.js'

/** Evidence picker (drag-and-drop dropzone) with client-side type/size/count checks. Controlled via files/onChange. */
export default function EvidencePicker(props) {
  return <FileDropzone {...props} />
}
