/**
 * Tooltip Manager - Centralized tooltip functionality
 * Extracted from CommunicationsSection.svelte for reusability
 */

let currentTooltip: HTMLElement | null = null;

function handleGlobalClick(event: MouseEvent) {
	if (currentTooltip && !currentTooltip.contains(event.target as Node)) {
		// Clicked outside tooltip, hide it
		hideTooltip();
	}
}

function hideTooltip() {
	if (currentTooltip) {
		document.body.removeChild(currentTooltip);
		currentTooltip = null;
		document.removeEventListener('click', handleGlobalClick);
	}
}

function createTooltipContent(message: any): string {
	if (!message.readingAssignments) return '';
	
	let content = '<div class="tooltip-header">Read Status</div>';
	content += '<div class="assignments-list">';
	
	message.readingAssignments.forEach((assignment: any) => {
		const assignmentTarget = `${assignment.assignedToType}: ${assignment.assignedTo}`;
		
		// Determine read status based on available data format
		let isRead = false;
		let readDetails = '';
		
		if (assignment.isFullyRead !== undefined) {
			// Old format: use pre-calculated isFullyRead
			isRead = assignment.isFullyRead;
			if (isRead && assignment.readBy && assignment.readBy.length > 0) {
				const readInfo = assignment.readBy[0];
				readDetails = ` (by ${readInfo.agentId})`;
			}
		} else if (assignment.reads) {
			// New format: check reads array
			isRead = assignment.reads.length > 0;
			if (isRead) {
				const readInfo = assignment.reads[0];
				readDetails = ` (by ${readInfo.agentId})`;
			}
		}
		
		const icon = isRead ? '✅' : '❌';
		const className = isRead ? 'assignment-read' : 'assignment-unread';
		const statusText = isRead ? 'Read' : 'Unread';
		
		content += `<div class="assignment-status ${className}">
			<span class="assignment-icon">${icon}</span>
			<span class="assignment-target">${assignmentTarget}</span>
			<span class="assignment-status-text">${statusText}${readDetails}</span>
		</div>`;
	});
	
	content += '</div>';
	return content;
}

export function toggleReadStatusTooltip(event: MouseEvent, message: any) {
	// If tooltip is already open, close it
	if (currentTooltip) {
		hideTooltip();
		return;
	}

	// Create tooltip content
	const tooltipContent = createTooltipContent(message);
	
	// Create new tooltip
	currentTooltip = document.createElement('div');
	currentTooltip.className = 'read-status-tooltip';
	currentTooltip.innerHTML = tooltipContent;
	
	document.body.appendChild(currentTooltip);
	
	// Position tooltip
	const rect = (event.target as HTMLElement).getBoundingClientRect();
	currentTooltip.style.position = 'fixed';
	currentTooltip.style.left = `${rect.left + rect.width + 4}px`;
	currentTooltip.style.top = `${rect.top - currentTooltip.offsetHeight / 2 + rect.height / 2}px`;
	currentTooltip.style.zIndex = '1000';
	currentTooltip.style.pointerEvents = 'auto';
	
	// Ensure tooltip doesn't go off-screen
	const tooltipRect = currentTooltip.getBoundingClientRect();
	if (tooltipRect.right > window.innerWidth) {
		currentTooltip.style.left = `${rect.left - currentTooltip.offsetWidth - 4}px`;
	}
	if (tooltipRect.top < 0) {
		currentTooltip.style.top = '8px';
	}
	
	// Add global click handler to dismiss when clicking elsewhere
	setTimeout(() => {
		document.addEventListener('click', handleGlobalClick);
	}, 0);
}