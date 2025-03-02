import {
  useRef,
  useLayoutEffect,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  cloneElement,
  Ref,
} from 'react';
import { PopoverPortal } from './PopoverPortal';
import {
  ContentLocation,
  ContentLocationGetter,
  PopoverPosition,
  PopoverProps,
  PopoverState,
} from '.';
import { EMPTY_CLIENT_RECT, rectsAreEqual } from './util';
import { usePopover } from './usePopover';
import { useMemoizedArray } from './useMemoizedArray';
export { useArrowContainer } from './useArrowContainer';
export { ArrowContainer } from './ArrowContainer';
export { usePopover };

const DEFAULT_POSITIONS: PopoverPosition[] = ['top', 'left', 'right', 'bottom'];

const PopoverInternal = forwardRef(
  (
    {
      isOpen,
      children,
      content,
      positions: externalPositions = DEFAULT_POSITIONS,
      align = 'center',
      padding = 0,
      reposition = true,
      parentElement = window.document.body,
      boundaryElement = parentElement,
      containerClassName = 'react-tiny-popover-container',
      containerStyle,
      contentLocation,
      boundaryInset = 0,
      onClickOutside,
      clickOutsideCapture = false,
    }: PopoverProps,
    externalRef: Ref<HTMLElement>,
  ) => {
    const positions = useMemoizedArray(externalPositions);

    // TODO: factor prevs out into a custom prevs hook
    const prevIsOpen = useRef(false);
    const prevPositions = useRef<PopoverPosition[] | undefined>();
    const prevContentLocation = useRef<ContentLocation | ContentLocationGetter | undefined>();
    const prevReposition = useRef(reposition);

    const childRef = useRef<HTMLElement | undefined>();

    const [popoverState, setPopoverState] = useState<PopoverState>({
      align,
      nudgedLeft: 0,
      nudgedTop: 0,
      position: positions[0],
      padding,
      childRect: EMPTY_CLIENT_RECT,
      popoverRect: EMPTY_CLIENT_RECT,
      parentRect: EMPTY_CLIENT_RECT,
      boundaryRect: EMPTY_CLIENT_RECT,
      boundaryInset,
      violations: EMPTY_CLIENT_RECT,
      hasViolations: false,
    });

    const onPositionPopover = useCallback(
      (popoverState: PopoverState) => setPopoverState(popoverState),
      [],
    );

    const { positionPopover, popoverRef, scoutRef } = usePopover({
      isOpen,
      childRef,
      containerClassName,
      parentElement,
      boundaryElement,
      contentLocation,
      positions,
      align,
      padding,
      boundaryInset,
      reposition,
      onPositionPopover,
    });

    useLayoutEffect(() => {
      let shouldUpdate = true;
      const updatePopover = () => {
        if (isOpen && shouldUpdate) {
          const childRect = childRef?.current?.getBoundingClientRect();
          const popoverRect = popoverRef?.current?.getBoundingClientRect();
          if (
            childRect != null &&
            popoverRect != null &&
            (!rectsAreEqual(childRect, {
              top: popoverState.childRect.top,
              left: popoverState.childRect.left,
              width: popoverState.childRect.width,
              height: popoverState.childRect.height,
              bottom: popoverState.childRect.top + popoverState.childRect.height,
              right: popoverState.childRect.left + popoverState.childRect.width,
            }) ||
              popoverRect.width !== popoverState.popoverRect.width ||
              popoverRect.height !== popoverState.popoverRect.height ||
              popoverState.padding !== padding ||
              popoverState.align !== align ||
              positions !== prevPositions.current ||
              contentLocation !== prevContentLocation.current ||
              reposition !== prevReposition.current)
          ) {
            positionPopover();
          }

          // TODO: factor prev checks out into the custom prevs hook
          if (positions !== prevPositions.current) {
            prevPositions.current = positions;
          }
          if (contentLocation !== prevContentLocation.current) {
            prevContentLocation.current = contentLocation;
          }
          if (reposition !== prevReposition.current) {
            prevReposition.current = reposition;
          }

          if (shouldUpdate) {
            window.requestAnimationFrame(updatePopover);
          }
        }

        prevIsOpen.current = isOpen;
      };

      window.requestAnimationFrame(updatePopover);

      return () => {
        shouldUpdate = false;
      };
    }, [
      align,
      contentLocation,
      isOpen,
      padding,
      popoverRef,
      popoverState.align,
      popoverState.childRect.height,
      popoverState.childRect.left,
      popoverState.childRect.top,
      popoverState.childRect.width,
      popoverState.padding,
      popoverState.popoverRect.height,
      popoverState.popoverRect.width,
      positionPopover,
      positions,
      reposition,
    ]);

    useEffect(() => {
      const popoverElement = popoverRef.current;

      Object.assign(popoverElement.style, containerStyle);

      return () => {
        Object.keys(containerStyle ?? {}).forEach(
          (key) =>
            delete popoverElement.style[
              key as keyof Omit<typeof containerStyle, 'length' | 'parentRule'>
            ],
        );
      };
    }, [containerStyle, isOpen, popoverRef]);

    const handleOnClickOutside = useCallback(
      (e: MouseEvent) => {
        if (
          isOpen &&
          !popoverRef.current?.contains(e.target as Node) &&
          !childRef.current?.contains(e.target as Node)
        ) {
          onClickOutside?.(e);
        }
      },
      [isOpen, onClickOutside, popoverRef],
    );

    const handleWindowResize = useCallback(() => {
      if (childRef.current) {
        window.requestAnimationFrame(() => positionPopover());
      }
    }, [positionPopover]);

    useEffect(() => {
      const body = parentElement.ownerDocument.body;
      body.addEventListener('click', handleOnClickOutside, clickOutsideCapture);
      body.addEventListener('contextmenu', handleOnClickOutside, clickOutsideCapture);
      body.addEventListener('resize', handleWindowResize);
      return () => {
        body.removeEventListener('click', handleOnClickOutside, clickOutsideCapture);
        body.removeEventListener('contextmenu', handleOnClickOutside, clickOutsideCapture);
        body.removeEventListener('resize', handleWindowResize);
      };
    }, [clickOutsideCapture, handleOnClickOutside, handleWindowResize, parentElement]);

    const handleRef = useCallback(
      (node: HTMLElement) => {
        childRef.current = node;
        if (externalRef != null) {
          if (typeof externalRef === 'object') {
            (externalRef as React.MutableRefObject<HTMLElement>).current = node;
          } else if (typeof externalRef === 'function') {
            (externalRef as (instance: HTMLElement) => void)(node);
          }
        }
      },
      [externalRef],
    );

    const renderChild = () =>
      cloneElement(children as JSX.Element, {
        ref: handleRef,
      });

    const renderPopover = () => {
      if (!isOpen) return null;
      return (
        <PopoverPortal
          element={popoverRef.current}
          scoutElement={scoutRef.current}
          container={parentElement}
        >
          {typeof content === 'function' ? content(popoverState) : content}
        </PopoverPortal>
      );
    };

    return (
      <>
        {renderChild()}
        {renderPopover()}
      </>
    );
  },
);

export const Popover = forwardRef<HTMLElement, PopoverProps>((props, ref) => {
  if (typeof window === 'undefined') return props.children;
  return <PopoverInternal {...props} ref={ref} />;
});
